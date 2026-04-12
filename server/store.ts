import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { AppData } from "./types";
import { seedData } from "./seed";
import { getReviewTaskStageLabel, inferReviewTaskStage } from "./services/review-task-stage-service";
import {
  enqueueRelationalMirrorSync,
  initializeRelationalMirror,
} from "./services/relational-mirror-service";

const dataDir = path.resolve(process.cwd(), "server-data");
const databaseFile = path.join(dataDir, "app-data.sqlite");
const legacyDataFile = path.join(dataDir, "app-data.json");

const collections = ["projects", "documents", "reviewTasks", "findings", "regulations"] as const;

type CollectionName = (typeof collections)[number];

let database: DatabaseSync | null = null;
let relationalMirrorInitialized = false;

const stripUtf8Bom = (value: string) => value.replace(/^\uFEFF/, "");

const ensureDataDir = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

const normalizeSnapshot = (data: AppData): AppData => ({
  ...data,
  documents: data.documents.map((document) => ({
    ...document,
    parseMethod: document.parseMethod ?? "binary-placeholder",
    textPreview: document.textPreview ?? "",
    extractedText: document.extractedText ?? "",
    chunks: (document.chunks ?? []).map((chunk) => ({
      ...chunk,
      sectionTitle: chunk.sectionTitle,
    })),
  })),
  regulations: data.regulations.map((regulation) => ({
    ...regulation,
    textPreview: regulation.textPreview ?? "",
    chunks: (regulation.chunks ?? []).map((chunk) => ({
      ...chunk,
      sectionTitle: chunk.sectionTitle,
    })),
  })),
  reviewTasks: data.reviewTasks.map((task) => {
    const normalizedStage = task.stage ?? inferReviewTaskStage(task);

    return {
      ...task,
      stage: normalizedStage,
      stageLabel: task.stageLabel || getReviewTaskStageLabel(normalizedStage),
      attemptCount: task.attemptCount ?? 1,
    };
  }),
  findings: data.findings.map((finding) => ({
    ...finding,
    sourceChunkIds: finding.sourceChunkIds ?? [],
    candidateChunkIds: finding.candidateChunkIds ?? [],
    regulationChunkIds: finding.regulationChunkIds ?? [],
    needsHumanReview: finding.needsHumanReview ?? true,
    confidence: finding.confidence ?? 0.5,
    reviewStage: finding.reviewStage ?? "chapter_review",
    reviewLogs: finding.reviewLogs ?? [],
  })),
});

const createEmptySnapshot = () => normalizeSnapshot(seedData());

const getDatabase = () => {
  if (database) return database;

  ensureDataDir();

  database = new DatabaseSync(databaseFile);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA synchronous = NORMAL;");
  database.exec("PRAGMA foreign_keys = OFF;");
  database.exec("PRAGMA busy_timeout = 5000;");
  database.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");

  collections.forEach((name) => {
    database!.exec(`CREATE TABLE IF NOT EXISTS ${name} (id TEXT PRIMARY KEY, payload TEXT NOT NULL);`);
  });

  bootstrapDatabase(database);

  if (!relationalMirrorInitialized) {
    initializeRelationalMirror(loadSnapshot(database));
    relationalMirrorInitialized = true;
  }

  return database;
};

const getMetaValue = (db: DatabaseSync, key: string) => {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
};

const setMetaValue = (db: DatabaseSync, key: string, value: string) => {
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run(key, value);
};

const isTableEmpty = (db: DatabaseSync, table: CollectionName) => {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
  return row.count === 0;
};

const readLegacySnapshot = () => {
  if (!fs.existsSync(legacyDataFile)) {
    return null;
  }

  const parsed = JSON.parse(stripUtf8Bom(fs.readFileSync(legacyDataFile, "utf8"))) as AppData;
  return normalizeSnapshot(parsed);
};

const loadCollection = <T>(db: DatabaseSync, table: CollectionName): T[] => {
  const rows = db.prepare(`SELECT payload FROM ${table}`).all() as Array<{ payload: string }>;
  return rows.map((row) => JSON.parse(row.payload) as T);
};

const persistCollection = <T extends { id: string }>(db: DatabaseSync, table: CollectionName, items: T[]) => {
  db.prepare(`DELETE FROM ${table}`).run();

  const insert = db.prepare(`INSERT INTO ${table} (id, payload) VALUES (?, ?)`);
  items.forEach((item) => {
    insert.run(item.id, JSON.stringify(item));
  });
};

const loadSnapshot = (db: DatabaseSync): AppData =>
  normalizeSnapshot({
    projects: loadCollection<AppData["projects"][number]>(db, "projects"),
    documents: loadCollection<AppData["documents"][number]>(db, "documents"),
    reviewTasks: loadCollection<AppData["reviewTasks"][number]>(db, "reviewTasks"),
    findings: loadCollection<AppData["findings"][number]>(db, "findings"),
    regulations: loadCollection<AppData["regulations"][number]>(db, "regulations"),
  });

const persistSnapshot = (db: DatabaseSync, current: AppData | null, next: AppData) => {
  if (!current || current.projects !== next.projects) {
    persistCollection(db, "projects", next.projects);
  }

  if (!current || current.documents !== next.documents) {
    persistCollection(db, "documents", next.documents);
  }

  if (!current || current.reviewTasks !== next.reviewTasks) {
    persistCollection(db, "reviewTasks", next.reviewTasks);
  }

  if (!current || current.findings !== next.findings) {
    persistCollection(db, "findings", next.findings);
  }

  if (!current || current.regulations !== next.regulations) {
    persistCollection(db, "regulations", next.regulations);
  }
};

const bootstrapDatabase = (db: DatabaseSync) => {
  if (getMetaValue(db, "bootstrapped") === "1") {
    return;
  }

  const hasExistingRows = collections.some((table) => !isTableEmpty(db, table));
  if (hasExistingRows) {
    setMetaValue(db, "bootstrapped", "1");
    return;
  }

  const snapshot = readLegacySnapshot() ?? createEmptySnapshot();
  persistSnapshot(db, null, snapshot);
  setMetaValue(db, "bootstrapped", "1");
};

export const store = {
  get(): AppData {
    return loadSnapshot(getDatabase());
  },
  update(updater: (current: AppData) => AppData): AppData {
    const db = getDatabase();
    db.exec("BEGIN IMMEDIATE;");

    try {
      const current = loadSnapshot(db);
      const next = normalizeSnapshot(updater(current));
      persistSnapshot(db, current, next);
      db.exec("COMMIT;");
      enqueueRelationalMirrorSync(next);
      return next;
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }
  },
};
