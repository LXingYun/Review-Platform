import fs from "node:fs";
import pdf from "pdf-parse";
import { extractImageText } from "./ocr-service";
import { DocumentChunk } from "../types";

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const previewText = (value: string, maxLength = 160) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
};

const buildChunks = (text: string): DocumentChunk[] => {
  if (!text.trim()) return [];

  return text
    .split(/(?<=[。！？；\n])/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
    .slice(0, 20)
    .map((chunk, index) => ({
      id: `chunk-${index + 1}`,
      order: index + 1,
      text: chunk,
    }));
};

const withChunks = (parsed: {
  pageCount: number;
  parseMethod: "pdf-text" | "plain-text" | "image-ocr" | "binary-placeholder";
  extractedText: string;
  textPreview: string;
}) => ({
  ...parsed,
  chunks: buildChunks(parsed.extractedText),
});

const parsePdf = async (fileBuffer: Buffer) => {
  const result = await pdf(fileBuffer);
  const extractedText = normalizeWhitespace(result.text ?? "");

  return withChunks({
    pageCount: result.numpages || 1,
    parseMethod: "pdf-text" as const,
    extractedText,
    textPreview: previewText(extractedText || "PDF 文本内容为空，需人工复核原文件。"),
  });
};

const parseTextLikeFile = (fileBuffer: Buffer) => {
  const extractedText = normalizeWhitespace(fileBuffer.toString("utf8"));

  return withChunks({
    pageCount: 1,
    parseMethod: "plain-text" as const,
    extractedText,
    textPreview: previewText(extractedText || "文本内容为空。"),
  });
};

const parseImageWithOcr = async (fileBuffer: Buffer) => {
  const extractedText = await extractImageText(fileBuffer);

  return withChunks({
    pageCount: 1,
    parseMethod: "image-ocr" as const,
    extractedText,
    textPreview: previewText(extractedText || "OCR 未识别到可用文本，建议检查图片清晰度。"),
  });
};

const parseBinaryFallback = (originalName: string) => withChunks({
  pageCount: 1,
  parseMethod: "binary-placeholder" as const,
  extractedText: "",
  textPreview: `${originalName} 暂未接入对应格式解析器，当前仅完成文件存储。`,
});

// The parser intentionally starts small: PDF first, text-like files second,
// and everything else falls back to a clear placeholder until OCR lands.
export const parseDocumentBuffer = async (params: {
  originalName: string;
  mimeType: string;
  fileBuffer: Buffer;
}) => {
  const lowerName = params.originalName.toLowerCase();

  if (params.mimeType.includes("pdf") || lowerName.endsWith(".pdf")) {
    return parsePdf(params.fileBuffer);
  }

  if (
    params.mimeType.startsWith("text/") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md")
  ) {
    return parseTextLikeFile(params.fileBuffer);
  }

  if (
    params.mimeType.startsWith("image/") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".webp")
  ) {
    return parseImageWithOcr(params.fileBuffer);
  }

  return parseBinaryFallback(params.originalName);
};

export const parseStoredDocument = async (storagePath: string, originalName: string, mimeType: string) => {
  const fileBuffer = fs.readFileSync(storagePath);
  return parseDocumentBuffer({ originalName, mimeType, fileBuffer });
};
