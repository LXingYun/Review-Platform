import { createHash } from "node:crypto";

const buildSelectionHash = (params: {
  fingerprint: string;
  reviewUnitId: string;
}) => createHash("sha256").update(`${params.fingerprint}::${params.reviewUnitId}`, "utf8").digest("hex");

export const selectKeyIndex = (params: {
  fingerprint: string;
  reviewUnitId: string;
  keyCount: number;
}) => {
  if (params.keyCount <= 0) {
    throw new Error("keyCount must be greater than 0");
  }

  const selectionHash = buildSelectionHash({
    fingerprint: params.fingerprint,
    reviewUnitId: params.reviewUnitId,
  });

  const numericPrefix = Number.parseInt(selectionHash.slice(0, 12), 16);
  return numericPrefix % params.keyCount;
};

export const resolveUnitKey = (params: {
  apiKeys: string[];
  fingerprint: string;
  reviewUnitId: string;
}) => {
  if (params.apiKeys.length === 0) {
    throw new Error("apiKeys must contain at least one key");
  }

  const index = selectKeyIndex({
    fingerprint: params.fingerprint,
    reviewUnitId: params.reviewUnitId,
    keyCount: params.apiKeys.length,
  });

  return {
    keyId: `fixed-key-${index + 1}`,
    apiKey: params.apiKeys[index],
    index,
  };
};
