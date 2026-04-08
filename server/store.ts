import fs from "node:fs";
import path from "node:path";
import { AppData } from "./types";
import { seedData } from "./seed";

const dataDir = path.resolve(process.cwd(), "server-data");
const dataFile = path.join(dataDir, "app-data.json");

const stripUtf8Bom = (value: string) => value.replace(/^\uFEFF/, "");

const ensureDataFile = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(seedData(), null, 2));
  }
};

const readData = (): AppData => {
  ensureDataFile();
  const parsed = JSON.parse(stripUtf8Bom(fs.readFileSync(dataFile, "utf8"))) as AppData;

  // Keep old local data files compatible as the document schema evolves.
  parsed.documents = parsed.documents.map((document) => ({
    ...document,
    parseMethod: document.parseMethod ?? "binary-placeholder",
    textPreview: document.textPreview ?? "",
    extractedText: document.extractedText ?? "",
    chunks: (document.chunks ?? []).map((chunk) => ({
      ...chunk,
      sectionTitle: chunk.sectionTitle,
    })),
  }));

  parsed.regulations = parsed.regulations.map((regulation) => ({
    ...regulation,
    textPreview: regulation.textPreview ?? "",
    chunks: (regulation.chunks ?? []).map((chunk) => ({
      ...chunk,
      sectionTitle: chunk.sectionTitle,
    })),
  }));

  parsed.findings = parsed.findings.map((finding) => ({
    ...finding,
    sourceChunkIds: finding.sourceChunkIds ?? [],
    candidateChunkIds: finding.candidateChunkIds ?? [],
    regulationChunkIds: finding.regulationChunkIds ?? [],
    needsHumanReview: finding.needsHumanReview ?? true,
    confidence: finding.confidence ?? 0.5,
    reviewStage: finding.reviewStage ?? "chapter_review",
  }));

  return parsed;
};

const writeData = (data: AppData) => {
  ensureDataFile();
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
};

// The store is intentionally tiny and file-backed so the frontend prototype
// can start calling real APIs without introducing a database on day one.
export const store = {
  get(): AppData {
    return readData();
  },
  update(updater: (current: AppData) => AppData): AppData {
    const next = updater(readData());
    writeData(next);
    return next;
  },
};
