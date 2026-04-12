import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AppData, Finding } from "../types";

const dataDir = path.resolve(process.cwd(), "server-data");
const relationalDatabaseFile = path.join(dataDir, "app-relational.sqlite");
const relationalSchemaVersion = "1";
const relationalSchemaVersionMetaKey = "relational_mirror_schema_version";
const relationalMirrorSyncedAtMetaKey = "relational_mirror_synced_at";

const relationalTableCreationStatements = [
  "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
  `CREATE TABLE IF NOT EXISTS rel_projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS rel_documents (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    role TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    parse_status TEXT NOT NULL,
    page_count INTEGER NOT NULL,
    parse_method TEXT NOT NULL,
    text_preview TEXT NOT NULL,
    extracted_text TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES rel_projects(id) ON DELETE CASCADE
  );`,
  "CREATE INDEX IF NOT EXISTS rel_documents_project_id_idx ON rel_documents(project_id);",
  `CREATE TABLE IF NOT EXISTS rel_document_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chunk_order INTEGER NOT NULL,
    text TEXT NOT NULL,
    section_title TEXT,
    FOREIGN KEY (document_id) REFERENCES rel_documents(id) ON DELETE CASCADE
  );`,
  "CREATE INDEX IF NOT EXISTS rel_document_chunks_document_id_idx ON rel_document_chunks(document_id);",
  `CREATE TABLE IF NOT EXISTS rel_review_tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    scenario TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    stage TEXT NOT NULL,
    stage_label TEXT NOT NULL,
    progress INTEGER NOT NULL,
    risk_level TEXT NOT NULL,
    attempt_count INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (project_id) REFERENCES rel_projects(id) ON DELETE CASCADE
  );`,
  "CREATE INDEX IF NOT EXISTS rel_review_tasks_project_id_idx ON rel_review_tasks(project_id);",
  `CREATE TABLE IF NOT EXISTS rel_review_task_documents (
    task_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    PRIMARY KEY (task_id, document_id),
    FOREIGN KEY (task_id) REFERENCES rel_review_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES rel_documents(id) ON DELETE CASCADE
  );`,
  "CREATE INDEX IF NOT EXISTS rel_review_task_documents_document_id_idx ON rel_review_task_documents(document_id);",
  `CREATE TABLE IF NOT EXISTS rel_findings (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    risk TEXT NOT NULL,
    status TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    needs_human_review INTEGER NOT NULL,
    confidence REAL NOT NULL,
    review_stage TEXT NOT NULL,
    scenario TEXT NOT NULL,
    created_at TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES rel_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES rel_review_tasks(id) ON DELETE CASCADE
  );`,
  "CREATE INDEX IF NOT EXISTS rel_findings_project_id_idx ON rel_findings(project_id);",
  "CREATE INDEX IF NOT EXISTS rel_findings_task_id_idx ON rel_findings(task_id);",
  "CREATE INDEX IF NOT EXISTS rel_findings_status_idx ON rel_findings(status);",
  `CREATE TABLE IF NOT EXISTS rel_finding_references (
    id TEXT PRIMARY KEY,
    finding_id TEXT NOT NULL,
    reference_type TEXT NOT NULL,
    reference_value TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    payload_json TEXT,
    FOREIGN KEY (finding_id) REFERENCES rel_findings(id) ON DELETE CASCADE
  );`,
  "CREATE INDEX IF NOT EXISTS rel_finding_references_finding_id_idx ON rel_finding_references(finding_id);",
  "CREATE INDEX IF NOT EXISTS rel_finding_references_type_idx ON rel_finding_references(reference_type);",
  `CREATE TABLE IF NOT EXISTS rel_finding_review_logs (
    id TEXT PRIMARY KEY,
    finding_id TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT,
    note TEXT NOT NULL,
    reviewer TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (finding_id) REFERENCES rel_findings(id) ON DELETE CASCADE
  );`,
  "CREATE INDEX IF NOT EXISTS rel_finding_review_logs_finding_id_idx ON rel_finding_review_logs(finding_id);",
  `CREATE TABLE IF NOT EXISTS rel_regulations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    rule_count INTEGER NOT NULL,
    updated TEXT NOT NULL,
    text_preview TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS rel_regulation_chunks (
    id TEXT PRIMARY KEY,
    regulation_id TEXT NOT NULL,
    chunk_order INTEGER NOT NULL,
    text TEXT NOT NULL,
    section_title TEXT,
    FOREIGN KEY (regulation_id) REFERENCES rel_regulations(id) ON DELETE CASCADE
  );`,
  "CREATE INDEX IF NOT EXISTS rel_regulation_chunks_regulation_id_idx ON rel_regulation_chunks(regulation_id);",
  `CREATE TABLE IF NOT EXISTS rel_regulation_sections (
    id TEXT PRIMARY KEY,
    regulation_id TEXT NOT NULL,
    title TEXT NOT NULL,
    rules INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    FOREIGN KEY (regulation_id) REFERENCES rel_regulations(id) ON DELETE CASCADE
  );`,
  "CREATE INDEX IF NOT EXISTS rel_regulation_sections_regulation_id_idx ON rel_regulation_sections(regulation_id);",
];

const relationalTableDeletionStatements = [
  "DELETE FROM rel_finding_review_logs;",
  "DELETE FROM rel_finding_references;",
  "DELETE FROM rel_findings;",
  "DELETE FROM rel_review_task_documents;",
  "DELETE FROM rel_document_chunks;",
  "DELETE FROM rel_regulation_chunks;",
  "DELETE FROM rel_regulation_sections;",
  "DELETE FROM rel_review_tasks;",
  "DELETE FROM rel_documents;",
  "DELETE FROM rel_regulations;",
  "DELETE FROM rel_projects;",
];

let relationalDatabase: DatabaseSync | null = null;
let pendingSnapshot: AppData | null = null;
let queueDrainScheduled = false;
let queueDraining = false;

const logRelationalMirrorError = (phase: string, error: unknown) => {
  console.error(`[relational-mirror] ${phase} failed`, error);
};

const ensureDataDir = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

const getRelationalDatabase = () => {
  if (relationalDatabase) return relationalDatabase;

  ensureDataDir();
  relationalDatabase = new DatabaseSync(relationalDatabaseFile);
  relationalDatabase.exec("PRAGMA journal_mode = WAL;");
  relationalDatabase.exec("PRAGMA synchronous = NORMAL;");
  relationalDatabase.exec("PRAGMA foreign_keys = OFF;");
  relationalDatabase.exec("PRAGMA busy_timeout = 5000;");
  return relationalDatabase;
};

const ensureRelationalTables = (db: DatabaseSync) => {
  relationalTableCreationStatements.forEach((statement) => {
    db.exec(statement);
  });
};

const withTransaction = (db: DatabaseSync, callback: () => void) => {
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("BEGIN IMMEDIATE;");

  try {
    callback();
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = OFF;");
  }
};

const buildFindingMetadata = (finding: Finding) =>
  JSON.stringify({
    references: finding.references,
    sourceChunkIds: finding.sourceChunkIds,
    candidateChunkIds: finding.candidateChunkIds,
    regulationChunkIds: finding.regulationChunkIds,
  });

export const syncRelationalMirrorSnapshot = (snapshot: AppData) => {
  const db = getRelationalDatabase();
  ensureRelationalTables(db);

  withTransaction(db, () => {
    relationalTableDeletionStatements.forEach((statement) => {
      db.exec(statement);
    });

    const insertProject = db.prepare(
      "INSERT INTO rel_projects (id, name, type, status, description, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    snapshot.projects.forEach((project) => {
      insertProject.run(project.id, project.name, project.type, project.status, project.description, project.createdAt);
    });

    const insertRegulation = db.prepare(
      "INSERT INTO rel_regulations (id, name, category, rule_count, updated, text_preview) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const insertRegulationChunk = db.prepare(
      "INSERT INTO rel_regulation_chunks (id, regulation_id, chunk_order, text, section_title) VALUES (?, ?, ?, ?, ?)",
    );
    const insertRegulationSection = db.prepare(
      "INSERT INTO rel_regulation_sections (id, regulation_id, title, rules, sort_order) VALUES (?, ?, ?, ?, ?)",
    );

    snapshot.regulations.forEach((regulation) => {
      insertRegulation.run(
        regulation.id,
        regulation.name,
        regulation.category,
        regulation.ruleCount,
        regulation.updated,
        regulation.textPreview,
      );

      regulation.chunks.forEach((chunk) => {
        insertRegulationChunk.run(
          chunk.id,
          regulation.id,
          chunk.order,
          chunk.text,
          chunk.sectionTitle ?? null,
        );
      });

      regulation.sections.forEach((section, index) => {
        insertRegulationSection.run(
          `${regulation.id}:section:${index + 1}`,
          regulation.id,
          section.title,
          section.rules,
          index,
        );
      });
    });

    const insertDocument = db.prepare(
      [
        "INSERT INTO rel_documents (",
        "id, project_id, file_name, original_name, mime_type, size_bytes, role, storage_path,",
        "parse_status, page_count, parse_method, text_preview, extracted_text, uploaded_at",
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ].join(" "),
    );
    const insertDocumentChunk = db.prepare(
      "INSERT INTO rel_document_chunks (id, document_id, chunk_order, text, section_title) VALUES (?, ?, ?, ?, ?)",
    );

    snapshot.documents.forEach((document) => {
      insertDocument.run(
        document.id,
        document.projectId,
        document.fileName,
        document.originalName,
        document.mimeType,
        document.sizeBytes,
        document.role,
        document.storagePath,
        document.parseStatus,
        document.pageCount,
        document.parseMethod,
        document.textPreview,
        document.extractedText,
        document.uploadedAt,
      );

      document.chunks.forEach((chunk) => {
        insertDocumentChunk.run(
          chunk.id,
          document.id,
          chunk.order,
          chunk.text,
          chunk.sectionTitle ?? null,
        );
      });
    });

    const insertReviewTask = db.prepare(
      [
        "INSERT INTO rel_review_tasks (",
        "id, project_id, scenario, name, status, stage, stage_label, progress, risk_level,",
        "attempt_count, created_at, completed_at",
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ].join(" "),
    );
    const insertReviewTaskDocument = db.prepare(
      "INSERT INTO rel_review_task_documents (task_id, document_id) VALUES (?, ?)",
    );

    snapshot.reviewTasks.forEach((task) => {
      insertReviewTask.run(
        task.id,
        task.projectId,
        task.scenario,
        task.name,
        task.status,
        task.stage,
        task.stageLabel,
        task.progress,
        task.riskLevel,
        task.attemptCount,
        task.createdAt,
        task.completedAt,
      );

      task.documentIds.forEach((documentId) => {
        insertReviewTaskDocument.run(task.id, documentId);
      });
    });

    const insertFinding = db.prepare(
      [
        "INSERT INTO rel_findings (",
        "id, project_id, task_id, title, category, risk, status, location, description, recommendation,",
        "needs_human_review, confidence, review_stage, scenario, created_at, metadata_json",
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ].join(" "),
    );
    const insertFindingReference = db.prepare(
      [
        "INSERT INTO rel_finding_references (",
        "id, finding_id, reference_type, reference_value, sort_order, payload_json",
        ") VALUES (?, ?, ?, ?, ?, ?)",
      ].join(" "),
    );
    const insertFindingReviewLog = db.prepare(
      [
        "INSERT INTO rel_finding_review_logs (",
        "id, finding_id, action, status, note, reviewer, created_at",
        ") VALUES (?, ?, ?, ?, ?, ?, ?)",
      ].join(" "),
    );

    snapshot.findings.forEach((finding) => {
      insertFinding.run(
        finding.id,
        finding.projectId,
        finding.taskId,
        finding.title,
        finding.category,
        finding.risk,
        finding.status,
        finding.location,
        finding.description,
        finding.recommendation,
        finding.needsHumanReview ? 1 : 0,
        finding.confidence,
        finding.reviewStage,
        finding.scenario,
        finding.createdAt,
        buildFindingMetadata(finding),
      );

      finding.references.forEach((reference, index) => {
        insertFindingReference.run(
          `${finding.id}:reference:text:${index + 1}`,
          finding.id,
          "text_reference",
          reference,
          index,
          null,
        );
      });

      finding.sourceChunkIds.forEach((chunkId, index) => {
        insertFindingReference.run(
          `${finding.id}:reference:source_chunk:${index + 1}`,
          finding.id,
          "source_chunk",
          chunkId,
          index,
          null,
        );
      });

      finding.candidateChunkIds.forEach((chunkId, index) => {
        insertFindingReference.run(
          `${finding.id}:reference:candidate_chunk:${index + 1}`,
          finding.id,
          "candidate_chunk",
          chunkId,
          index,
          null,
        );
      });

      finding.regulationChunkIds.forEach((chunkId, index) => {
        insertFindingReference.run(
          `${finding.id}:reference:regulation_chunk:${index + 1}`,
          finding.id,
          "regulation_chunk",
          chunkId,
          index,
          null,
        );
      });

      finding.reviewLogs.forEach((reviewLog) => {
        insertFindingReviewLog.run(
          reviewLog.id,
          finding.id,
          reviewLog.action,
          reviewLog.status ?? null,
          reviewLog.note,
          reviewLog.reviewer,
          reviewLog.createdAt,
        );
      });
    });

    const setMetaValue = db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)");
    setMetaValue.run(relationalSchemaVersionMetaKey, relationalSchemaVersion);
    setMetaValue.run(relationalMirrorSyncedAtMetaKey, new Date().toISOString());
  });
};

const drainQueue = () => {
  if (queueDraining) return;
  queueDraining = true;

  try {
    while (pendingSnapshot) {
      const snapshot = pendingSnapshot;
      pendingSnapshot = null;

      try {
        syncRelationalMirrorSnapshot(snapshot);
      } catch (error) {
        logRelationalMirrorError("snapshot-sync", error);
      }
    }
  } finally {
    queueDraining = false;
    if (pendingSnapshot) {
      scheduleQueueDrain();
    }
  }
};

const scheduleQueueDrain = () => {
  if (queueDrainScheduled) return;
  queueDrainScheduled = true;

  queueMicrotask(() => {
    queueDrainScheduled = false;
    drainQueue();
  });
};

export const initializeRelationalMirror = (snapshot: AppData) => {
  try {
    syncRelationalMirrorSnapshot(snapshot);
  } catch (error) {
    logRelationalMirrorError("initialize", error);
  }
};

export const enqueueRelationalMirrorSync = (snapshot: AppData) => {
  pendingSnapshot = snapshot;
  scheduleQueueDrain();
};

export const getRelationalMirrorDatabaseFile = () => relationalDatabaseFile;

