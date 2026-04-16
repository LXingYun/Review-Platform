import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { store } from "../store";
import { DocumentRecord, DocumentRole } from "../types";
import {
  createId,
  extensionFromName,
  normalizeUploadedFileName,
  nowIso,
  sanitizeFileName,
} from "../utils";
import {
  assertDocumentAccess,
  assertProjectAccess,
  getAccessibleProjectIdSet,
  resolveActor,
} from "./access-control-service";
import type { AuthActor } from "./auth-types";
import { badRequest } from "./http-error";
import { isSupportedUpload, parseDocumentBuffer } from "./document-parse-service";

const uploadDir = path.resolve(process.cwd(), "storage", "uploads");

const ensureUploadDir = () => {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
};

const buildContentHash = (fileBuffer: Buffer) => createHash("sha256").update(fileBuffer).digest("hex");

const cloneChunksForDocument = (source: DocumentRecord, documentId: string) =>
  source.chunks.map((chunk, index) => ({
    id: `${documentId}-chunk-${index + 1}`,
    order: chunk.order,
    text: chunk.text,
    sectionTitle: chunk.sectionTitle,
  }));

export const listDocuments = (projectId?: string, actor?: AuthActor) => {
  const accessActor = resolveActor(actor);
  const data = store.get();

  if (projectId) {
    assertProjectAccess(accessActor, projectId, data);
    return data.documents.filter((document) => document.projectId === projectId);
  }

  const accessibleProjectIds = getAccessibleProjectIdSet(accessActor, data);
  return data.documents.filter((document) => accessibleProjectIds.has(document.projectId));
};

export const saveUploadedDocument = async (params: {
  projectId: string;
  role: DocumentRole;
  file: Express.Multer.File;
  actor?: AuthActor;
}) => {
  const accessActor = resolveActor(params.actor);
  const snapshot = store.get();
  assertProjectAccess(accessActor, params.projectId, snapshot);

  ensureUploadDir();

  const normalizedOriginalName = normalizeUploadedFileName(params.file.originalname);

  if (
    !isSupportedUpload({
      originalName: normalizedOriginalName,
      mimeType: params.file.mimetype || "application/octet-stream",
    })
  ) {
    throw badRequest("Unsupported upload file type.");
  }

  const documentId = createId("doc");
  const contentHash = buildContentHash(params.file.buffer);
  const extension = extensionFromName(normalizedOriginalName) || ".bin";
  const storedName = `${createId("file")}-${sanitizeFileName(normalizedOriginalName.replace(extension, ""))}${extension}`;
  const storedPath = path.join(uploadDir, storedName);

  fs.writeFileSync(storedPath, params.file.buffer);

  const existingDocument = snapshot.documents.find((document) => document.contentHash === contentHash);

  const parsedDocument = existingDocument
    ? {
        pageCount: existingDocument.pageCount,
        parseMethod: existingDocument.parseMethod,
        textPreview: existingDocument.textPreview,
        extractedText: existingDocument.extractedText,
        chunks: cloneChunksForDocument(existingDocument, documentId),
      }
    : await parseDocumentBuffer({
        originalName: normalizedOriginalName,
        mimeType: params.file.mimetype || "application/octet-stream",
        fileBuffer: params.file.buffer,
        chunkIdPrefix: documentId,
      });

  const document: DocumentRecord = {
    id: documentId,
    projectId: params.projectId,
    fileName: storedName,
    originalName: normalizedOriginalName,
    mimeType: params.file.mimetype || "application/octet-stream",
    sizeBytes: params.file.size,
    role: params.role,
    storagePath: storedPath,
    parseStatus: "已完成",
    pageCount: parsedDocument.pageCount,
    parseMethod: parsedDocument.parseMethod,
    textPreview: parsedDocument.textPreview,
    extractedText: parsedDocument.extractedText,
    chunks: parsedDocument.chunks,
    contentHash,
    uploadedAt: nowIso(),
  };

  store.update((current) => ({
    ...current,
    documents: [document, ...current.documents],
  }));

  return document;
};

export const deleteDocument = (documentId: string, actor?: AuthActor) => {
  const accessActor = resolveActor(actor);
  const current = store.get();
  const document = assertDocumentAccess(accessActor, documentId, current);

  if (document.storagePath && fs.existsSync(document.storagePath)) {
    fs.rmSync(document.storagePath, { force: true });
  }

  const removedTaskIds = current.reviewTasks
    .filter((task) => task.documentIds.includes(documentId))
    .map((task) => task.id);

  store.update((state) => ({
    ...state,
    documents: state.documents.filter((item) => item.id !== documentId),
    reviewTasks: state.reviewTasks.filter((task) => !task.documentIds.includes(documentId)),
    findings: state.findings.filter((finding) => !removedTaskIds.includes(finding.taskId)),
  }));

  return { success: true, documentId };
};
