import { DocumentChunk, Regulation } from "../types";

export interface RegulationChunkCandidate {
  regulation: Regulation;
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

// This is a lightweight retrieval layer. It narrows regulation candidates
// before we add embeddings or LLM-based relevance ranking.
export const matchRegulationChunks = (params: {
  sourceChunk: DocumentChunk;
  regulations: Regulation[];
  preferredKeywords?: string[];
  limit?: number;
}) => {
  const sourceTokens = tokenize(params.sourceChunk.text);
  const keywordPool = unique([...(params.preferredKeywords ?? []), ...sourceTokens]).filter(Boolean);

  const candidates: RegulationChunkCandidate[] = [];

  params.regulations.forEach((regulation) => {
    regulation.chunks.forEach((chunk) => {
      const matchedKeywords = keywordPool.filter((keyword) => chunk.text.includes(keyword));
      if (matchedKeywords.length === 0) return;

      const score = matchedKeywords.length * 10 + Math.min(chunk.text.length, 120) / 120;

      candidates.push({
        regulation,
        chunk,
        score,
        matchedKeywords,
      });
    });
  });

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, params.limit ?? 2);
};
