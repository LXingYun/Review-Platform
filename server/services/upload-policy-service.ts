import multer from "multer";
import { normalizeUploadedFileName } from "../utils";
import { isSupportedUpload } from "./document-parse-service";

const defaultUploadMaxFileSizeMb = 50;

const parseMaxFileSizeMb = (raw: string | undefined) => {
  if (!raw) return defaultUploadMaxFileSizeMb;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultUploadMaxFileSizeMb;
};

export const uploadMaxFileSizeBytes = parseMaxFileSizeMb(process.env.UPLOAD_MAX_FILE_SIZE_MB) * 1024 * 1024;

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

const fileFilter: multer.Options["fileFilter"] = (_req, file, callback) => {
  const normalizedOriginalName = normalizeUploadedFileName(file.originalname ?? "");
  const mimeType = file.mimetype || "application/octet-stream";

  if (!isSupportedUpload({ originalName: normalizedOriginalName, mimeType })) {
    callback(new UploadValidationError("仅支持 PDF、文本和图片文件上传"));
    return;
  }

  callback(null, true);
};

export const createUploadMiddleware = () =>
  multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: uploadMaxFileSizeBytes,
    },
    fileFilter,
  });
