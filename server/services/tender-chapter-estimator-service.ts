import { DocumentChunk, DocumentRecord, Regulation } from "../types";
import { matchRegulationChunks } from "./regulation-match-service";

interface TenderChapterLike {
  id: string;
  title: string;
  pageRange: string;
  chunks: DocumentChunk[];
}

interface RegulationCandidateSummary {
  regulationName: string;
  regulationCategory: string;
  sectionTitle?: string;
  chunkId: string;
  text: string;
  matchedKeywords: string[];
}

interface CachedRegulationCandidateSummary extends RegulationCandidateSummary {
  uniqueKey: string;
  score: number;
  jsonLength: number;
}

const chapterReviewPreferredKeywords = [
  "保证金",
  "资格",
  "资质",
  "评标",
  "评分",
  "限制",
  "排斥",
  "工期",
  "合同",
  "技术",
];

const countNonWhitespace = (value: string) => value.replace(/\s+/g, "").length;

const estimateSerializedValueLength = (value: unknown) => countNonWhitespace(JSON.stringify(value));

const estimateArrayLength = (itemLengths: number[]) =>
  itemLengths.length === 0 ? 2 : 2 + itemLengths.reduce((sum, itemLength) => sum + itemLength, 0) + itemLengths.length - 1;

const estimateObjectLength = (entries: Array<readonly [key: string, valueLength: number]>) =>
  entries.length === 0
    ? 2
    : 2 +
      entries.reduce(
        (sum, [key, valueLength]) => sum + JSON.stringify(key).length + 1 + valueLength,
        0,
      ) +
      entries.length -
      1;

const buildChunkSpanKey = (chapter: TenderChapterLike) => {
  const firstChunkId = chapter.chunks[0]?.id ?? "";
  const lastChunkId = chapter.chunks[chapter.chunks.length - 1]?.id ?? "";
  return `${chapter.title}|${firstChunkId}|${lastChunkId}|${chapter.chunks.length}`;
};

const buildChunkRangeLength = (prefixSums: number[], startIndex: number, endIndex: number) => {
  const count = endIndex - startIndex + 1;
  if (count <= 0) return 2;

  return 2 + (prefixSums[endIndex + 1] - prefixSums[startIndex]) + count - 1;
};

const toCachedRegulationCandidateSummary = (
  regulation: Regulation,
  chunk: DocumentChunk,
  score: number,
  matchedKeywords: string[],
): CachedRegulationCandidateSummary => {
  const summary: RegulationCandidateSummary = {
    regulationName: regulation.name,
    regulationCategory: regulation.category,
    sectionTitle: chunk.sectionTitle,
    chunkId: chunk.id,
    text: chunk.text,
    matchedKeywords,
  };

  return {
    ...summary,
    uniqueKey: `${regulation.id}:${chunk.id}`,
    score,
    jsonLength: estimateSerializedValueLength(summary),
  };
};

export const createTenderChapterPromptEstimator = (params: {
  document: DocumentRecord;
  regulations: Regulation[];
  systemPrompt: string;
  metadata: unknown;
  outputContract: unknown;
}) => {
  const documentChunkIndexMap = new Map(params.document.chunks.map((chunk, index) => [chunk.id, index]));
  const chunkJsonLengthPrefixSums = new Array<number>(params.document.chunks.length + 1).fill(0);

  params.document.chunks.forEach((chunk, index) => {
    chunkJsonLengthPrefixSums[index + 1] = chunkJsonLengthPrefixSums[index] + estimateSerializedValueLength(chunk);
  });

  const regulationCandidateSummaryByChunkId = new Map<string, CachedRegulationCandidateSummary[]>();
  params.document.chunks.forEach((chunk) => {
    const summaries = params.regulations.length
      ? matchRegulationChunks({
          sourceChunk: chunk,
          regulations: params.regulations,
          preferredKeywords: chapterReviewPreferredKeywords,
          limit: 2,
        }).map((candidate) =>
          toCachedRegulationCandidateSummary(
            candidate.regulation,
            candidate.chunk,
            candidate.score,
            candidate.matchedKeywords,
          ),
        )
      : [];

    regulationCandidateSummaryByChunkId.set(chunk.id, summaries);
  });

  const systemPromptLength = countNonWhitespace(params.systemPrompt);
  const metadataLength = estimateSerializedValueLength(params.metadata);
  const outputContractLength = estimateSerializedValueLength(params.outputContract);
  const spanLengthCache = new Map<string, number>();

  return (chapter: TenderChapterLike) => {
    const spanKey = buildChunkSpanKey(chapter);
    const cachedLength = spanLengthCache.get(spanKey);
    if (cachedLength !== undefined) {
      return cachedLength;
    }

    const firstChunkId = chapter.chunks[0]?.id;
    const lastChunkId = chapter.chunks[chapter.chunks.length - 1]?.id;
    const firstChunkIndex = firstChunkId ? documentChunkIndexMap.get(firstChunkId) : undefined;
    const lastChunkIndex = lastChunkId ? documentChunkIndexMap.get(lastChunkId) : undefined;

    const chunkArrayLength =
      firstChunkIndex !== undefined && lastChunkIndex !== undefined
        ? buildChunkRangeLength(chunkJsonLengthPrefixSums, firstChunkIndex, lastChunkIndex)
        : estimateArrayLength(chapter.chunks.map((chunk) => estimateSerializedValueLength(chunk)));

    const uniqueRegulationCandidates = new Map<string, CachedRegulationCandidateSummary>();
    chapter.chunks.forEach((chunk) => {
      const chunkCandidates = regulationCandidateSummaryByChunkId.get(chunk.id) ?? [];
      chunkCandidates.forEach((candidate) => {
        if (!uniqueRegulationCandidates.has(candidate.uniqueKey)) {
          uniqueRegulationCandidates.set(candidate.uniqueKey, candidate);
        }
      });
    });

    const regulationCandidatesLength = estimateArrayLength(
      Array.from(uniqueRegulationCandidates.values())
        .sort((left, right) => right.score - left.score)
        .slice(0, 4)
        .map((candidate) => candidate.jsonLength),
    );

    const chapterLength = estimateObjectLength([
      ["id", estimateSerializedValueLength(chapter.id)],
      ["title", estimateSerializedValueLength(chapter.title)],
      ["pageRange", estimateSerializedValueLength(chapter.pageRange)],
      ["chunks", chunkArrayLength],
    ]);

    const promptLength =
      systemPromptLength +
      estimateObjectLength([
        ["metadata", metadataLength],
        ["chapter", chapterLength],
        ["regulationCandidates", regulationCandidatesLength],
        ["outputContract", outputContractLength],
      ]);

    spanLengthCache.set(spanKey, promptLength);
    return promptLength;
  };
};
