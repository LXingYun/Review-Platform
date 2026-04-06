import { createWorker } from "tesseract.js";

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

// OCR is intentionally isolated so we can later swap in PaddleOCR or a cloud
// document service without rewriting the parser orchestration.
export const extractImageText = async (imageBuffer: Buffer) => {
  const worker = await createWorker("eng");

  try {
    const result = await worker.recognize(imageBuffer);
    return normalizeWhitespace(result.data.text ?? "");
  } finally {
    await worker.terminate();
  }
};
