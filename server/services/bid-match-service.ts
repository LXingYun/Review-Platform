import { DocumentChunk } from "../types";

export interface BidChunkCandidate {
  chunk: DocumentChunk;
  score: number;
  matchedKeywords: string[];
}

const unique = <T>(values: T[]) => Array.from(new Set(values));

const tokenize = (value: string) =>
  unique(
    value
      .split(/[^\p{L}\p{N}]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  );

// This retrieval layer narrows bid response candidates before semantic
// comparison. Later we can replace or augment it with embeddings.
export const matchBidChunks = (params: {
  sourceChunk: DocumentChunk;
  bidChunks: DocumentChunk[];
  preferredKeywords?: string[];
  limit?: number;
}) => {
  const sourceTokens = tokenize(params.sourceChunk.text);
  const keywordPool = unique([...(params.preferredKeywords ?? []), ...sourceTokens]).filter(Boolean);

  const candidates: BidChunkCandidate[] = params.bidChunks
    .map((chunk) => {
      const matchedKeywords = keywordPool.filter((keyword) => chunk.text.includes(keyword));
      if (matchedKeywords.length === 0) return null;

      return {
        chunk,
        matchedKeywords,
        score: matchedKeywords.length * 10 + Math.min(chunk.text.length, 120) / 120,
      };
    })
    .filter((candidate): candidate is BidChunkCandidate => candidate !== null);

  return candidates.sort((a, b) => b.score - a.score).slice(0, params.limit ?? 2);
};
