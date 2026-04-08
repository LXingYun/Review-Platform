import { createWorker } from "tesseract.js";

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const PADDLE_OCR_MAX_PDF_PAGES = 100;

const getPaddleOcrConfig = () => {
  const apiUrl = process.env.PADDLE_OCR_API_URL ?? "";
  const token = process.env.PADDLE_OCR_TOKEN ?? "";
  const timeoutMs = Number(process.env.PADDLE_OCR_TIMEOUT_MS ?? 120000);

  return {
    enabled: Boolean(apiUrl && token),
    apiUrl,
    token,
    timeoutMs,
  };
};

const extractTextFromPaddleResponse = (payload: unknown) => {
  const candidates =
    Array.isArray((payload as { result?: { ocrResults?: unknown[] } })?.result?.ocrResults)
      ? ((payload as { result: { ocrResults: unknown[] } }).result.ocrResults as Array<{ prunedResult?: string }>)
      : [];

  if (candidates.length === 0) {
    throw new Error("PaddleOCR 返回结果为空");
  }

  const text = normalizeWhitespace(
    candidates
      .map((item) => (typeof item?.prunedResult === "string" ? item.prunedResult : ""))
      .filter(Boolean)
      .join("\n"),
  );

  return {
    text,
    pageCount: candidates.length,
  };
};

const requestPaddleOcr = async (params: {
  fileBuffer: Buffer;
  fileType: 0 | 1;
}) => {
  const config = getPaddleOcrConfig();

  if (!config.enabled) {
    throw new Error("PaddleOCR 未配置 PADDLE_OCR_API_URL 或 PADDLE_OCR_TOKEN");
  }

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      Authorization: `token ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file: params.fileBuffer.toString("base64"),
      fileType: params.fileType,
      visualize: false,
      useDocOrientationClassify: true,
      useDocUnwarping: true,
      useTextlineOrientation: true,
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PaddleOCR 请求失败 (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as unknown;
  return extractTextFromPaddleResponse(payload);
};

const extractImageTextWithTesseract = async (imageBuffer: Buffer) => {
  const worker = await createWorker("chi_sim+eng");

  try {
    const result = await worker.recognize(imageBuffer);
    return normalizeWhitespace(result.data.text ?? "");
  } finally {
    await worker.terminate();
  }
};

export const extractImageText = async (imageBuffer: Buffer) => {
  const config = getPaddleOcrConfig();

  if (config.enabled) {
    const result = await requestPaddleOcr({
      fileBuffer: imageBuffer,
      fileType: 1,
    });
    return result.text;
  }

  return extractImageTextWithTesseract(imageBuffer);
};

export const extractPdfTextWithOcr = async (pdfBuffer: Buffer) => {
  const result = await requestPaddleOcr({
    fileBuffer: pdfBuffer,
    fileType: 0,
  });

  return result.text;
};

export const getPdfOcrPageLimit = () => PADDLE_OCR_MAX_PDF_PAGES;
