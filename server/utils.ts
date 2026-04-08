import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { RiskLevel } from "./types";

export const createId = (prefix: string) => `${prefix}-${uuidv4()}`;

export const nowIso = () => new Date().toISOString();

export const toDisplaySize = (sizeBytes: number) => `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;

export const sanitizeFileName = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").toLowerCase();

export const extensionFromName = (name: string) => path.extname(name).toLowerCase();

export const normalizeUploadedFileName = (name: string) => {
  try {
    return Buffer.from(name, "latin1").toString("utf8");
  } catch {
    return name;
  }
};

export const summarizeRisk = (risks: RiskLevel[]): RiskLevel => {
  if (risks.includes("高")) return "高";
  if (risks.includes("中")) return "中";
  return "低";
};
