import fs from "node:fs";
import pdf from "pdf-parse";
import { PDFDocument } from "pdf-lib";
import { extractImageText, extractPdfTextWithOcr, getPdfOcrPageLimit } from "./ocr-service";
import { DocumentChunk } from "../types";

const supportedTextExtensions = new Set([".txt", ".md"]);
const supportedImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const previewText = (value: string, maxLength = 160) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
};

const buildChunks = (text: string, chunkIdPrefix: string): DocumentChunk[] => {
  if (!text.trim()) return [];

  return text
    .split(/(?<=[。！？；\n])/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
    .map((chunk, index) => ({
      id: `${chunkIdPrefix}-chunk-${index + 1}`,
      order: index + 1,
      text: chunk,
    }));
};

const withChunks = (
  parsed: {
    pageCount: number;
    parseMethod: "pdf-text" | "plain-text" | "image-ocr" | "binary-placeholder";
    extractedText: string;
    textPreview: string;
  },
  chunkIdPrefix: string,
) => ({
  ...parsed,
  chunks: buildChunks(parsed.extractedText, chunkIdPrefix),
});

const splitPdfByPageLimit = async (fileBuffer: Buffer, maxPages: number) => {
  const source = await PDFDocument.load(fileBuffer);
  const totalPages = source.getPageCount();

  if (totalPages <= maxPages) {
    return [fileBuffer];
  }

  const parts: Buffer[] = [];

  for (let start = 0; start < totalPages; start += maxPages) {
    const end = Math.min(start + maxPages, totalPages);
    const target = await PDFDocument.create();
    const copiedPages = await target.copyPages(
      source,
      Array.from({ length: end - start }, (_, index) => start + index),
    );

    copiedPages.forEach((page) => target.addPage(page));
    parts.push(Buffer.from(await target.save()));
  }

  return parts;
};

const parsePdf = async (fileBuffer: Buffer, chunkIdPrefix: string) => {
  const result = await pdf(fileBuffer);
  const nativeText = normalizeWhitespace(result.text ?? "");
  const pageCount = result.numpages || 1;

  if (nativeText.length >= 80) {
    return withChunks(
      {
        pageCount,
        parseMethod: "pdf-text",
        extractedText: nativeText,
        textPreview: previewText(nativeText || "PDF 文本内容为空，需要人工复核原文件。"),
      },
      chunkIdPrefix,
    );
  }

  try {
    const pdfParts = await splitPdfByPageLimit(fileBuffer, getPdfOcrPageLimit());
    const ocrTexts: string[] = [];

    for (const part of pdfParts) {
      const text = await extractPdfTextWithOcr(part);
      if (text) {
        ocrTexts.push(text);
      }
    }

    const extractedText = normalizeWhitespace(ocrTexts.join("\n"));
    if (extractedText) {
      return withChunks(
        {
          pageCount,
          parseMethod: "image-ocr",
          extractedText,
          textPreview: previewText(extractedText),
        },
        chunkIdPrefix,
      );
    }
  } catch (error) {
    if (nativeText) {
      return withChunks(
        {
          pageCount,
          parseMethod: "pdf-text",
          extractedText: nativeText,
          textPreview: previewText(nativeText),
        },
        chunkIdPrefix,
      );
    }

    const message = error instanceof Error ? error.message : "PDF OCR 失败";
    return withChunks(
      {
        pageCount,
        parseMethod: "binary-placeholder",
        extractedText: "",
        textPreview: `PDF 未提取到可用文本，${message}`,
      },
      chunkIdPrefix,
    );
  }

  return withChunks(
    {
      pageCount,
      parseMethod: nativeText ? "pdf-text" : "binary-placeholder",
      extractedText: nativeText,
      textPreview: previewText(nativeText || "PDF 未提取到可用文本，请检查文件是否为扫描件。"),
    },
    chunkIdPrefix,
  );
};

const parseTextLikeFile = (fileBuffer: Buffer, chunkIdPrefix: string) => {
  const extractedText = normalizeWhitespace(fileBuffer.toString("utf8"));

  return withChunks(
    {
      pageCount: 1,
      parseMethod: "plain-text",
      extractedText,
      textPreview: previewText(extractedText || "文本内容为空。"),
    },
    chunkIdPrefix,
  );
};

const parseImageWithOcr = async (fileBuffer: Buffer, chunkIdPrefix: string) => {
  const extractedText = await extractImageText(fileBuffer);

  return withChunks(
    {
      pageCount: 1,
      parseMethod: "image-ocr",
      extractedText,
      textPreview: previewText(extractedText || "OCR 未识别到可用文本，请检查图片清晰度。"),
    },
    chunkIdPrefix,
  );
};

const parseBinaryFallback = (originalName: string, chunkIdPrefix: string) =>
  withChunks(
    {
      pageCount: 1,
      parseMethod: "binary-placeholder",
      extractedText: "",
      textPreview: `${originalName} 暂未接入对应格式解析器，当前仅完成文件存储。`,
    },
    chunkIdPrefix,
  );

export const isSupportedUpload = (params: {
  originalName: string;
  mimeType: string;
}) => {
  const lowerName = params.originalName.toLowerCase();

  if (params.mimeType.includes("pdf") || lowerName.endsWith(".pdf")) {
    return true;
  }

  if (
    params.mimeType.startsWith("text/") ||
    Array.from(supportedTextExtensions).some((extension) => lowerName.endsWith(extension))
  ) {
    return true;
  }

  if (
    params.mimeType.startsWith("image/") ||
    Array.from(supportedImageExtensions).some((extension) => lowerName.endsWith(extension))
  ) {
    return true;
  }

  return false;
};

export const parseDocumentBuffer = async (params: {
  originalName: string;
  mimeType: string;
  fileBuffer: Buffer;
  chunkIdPrefix: string;
}) => {
  const lowerName = params.originalName.toLowerCase();

  if (params.mimeType.includes("pdf") || lowerName.endsWith(".pdf")) {
    return parsePdf(params.fileBuffer, params.chunkIdPrefix);
  }

  if (
    params.mimeType.startsWith("text/") ||
    Array.from(supportedTextExtensions).some((extension) => lowerName.endsWith(extension))
  ) {
    return parseTextLikeFile(params.fileBuffer, params.chunkIdPrefix);
  }

  if (
    params.mimeType.startsWith("image/") ||
    Array.from(supportedImageExtensions).some((extension) => lowerName.endsWith(extension))
  ) {
    return parseImageWithOcr(params.fileBuffer, params.chunkIdPrefix);
  }

  return parseBinaryFallback(params.originalName, params.chunkIdPrefix);
};

export const parseStoredDocument = async (
  storagePath: string,
  originalName: string,
  mimeType: string,
  chunkIdPrefix: string,
) => {
  const fileBuffer = fs.readFileSync(storagePath);
  return parseDocumentBuffer({ originalName, mimeType, fileBuffer, chunkIdPrefix });
};
