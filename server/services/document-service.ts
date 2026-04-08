import fs from "node:fs";
import path from "node:path";
import { store } from "../store";
import { DocumentRecord, DocumentRole } from "../types";
import { createId, extensionFromName, normalizeUploadedFileName, nowIso, sanitizeFileName } from "../utils";
import { isSupportedUpload, parseDocumentBuffer } from "./document-parse-service";

const uploadDir = path.resolve(process.cwd(), "storage", "uploads");

const ensureUploadDir = () => {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
};

export const listDocuments = (projectId?: string) => {
  const data = store.get();

  return data.documents.filter((document) => {
    if (!projectId) return true;
    return document.projectId === projectId;
  });
};

export const saveUploadedDocument = async (params: {
  projectId: string;
  role: DocumentRole;
  file: Express.Multer.File;
}) => {
  ensureUploadDir();

  const normalizedOriginalName = normalizeUploadedFileName(params.file.originalname);

  if (
    !isSupportedUpload({
      originalName: normalizedOriginalName,
      mimeType: params.file.mimetype || "application/octet-stream",
    })
  ) {
    throw new Error("仅支持 PDF、文本和图片文件上传");
  }

  const documentId = createId("doc");
  const extension = extensionFromName(normalizedOriginalName) || ".bin";
  const storedName = `${createId("file")}-${sanitizeFileName(normalizedOriginalName.replace(extension, ""))}${extension}`;
  const storedPath = path.join(uploadDir, storedName);

  fs.writeFileSync(storedPath, params.file.buffer);

  const parsedDocument = await parseDocumentBuffer({
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
    uploadedAt: nowIso(),
  };

  store.update((current) => ({
    ...current,
    documents: [document, ...current.documents],
  }));

  return document;
};

export const deleteDocument = (documentId: string) => {
  const current = store.get();
  const document = current.documents.find((item) => item.id === documentId);

  if (!document) {
    throw new Error("文件不存在");
  }

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
