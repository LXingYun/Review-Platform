import { z } from "zod";
import { requestStructuredAiReview } from "./ai-client-service";
import type { AiRetryEvent } from "./ai-retry-service";
import { matchRegulationChunks } from "./regulation-match-service";
import {
  createReviewChapterConcurrencyController,
  runWithAdaptiveChapterConcurrency,
} from "./review-chapter-concurrency-service";
import { createId, nowIso } from "../utils";
import { DocumentChunk, DocumentRecord, Finding, Regulation, TenderFindingCategory } from "../types";

interface TenderChapter {
  id: string;
  title: string;
  text: string;
  chunks: DocumentChunk[];
  pageRange: string;
}

interface TenderChapterDraft {
  startIndex: number;
  title: string;
  chunks: DocumentChunk[];
}

type ChapterHeadingLevel = "strong" | "weak";

interface ChapterHeadingMatch {
  level: ChapterHeadingLevel;
  title: string;
}

const tenderCategoryEnum = z.enum([
  "\u8d44\u683c\u6761\u4ef6",
  "\u8bc4\u6807\u529e\u6cd5",
  "\u4fdd\u8bc1\u91d1\u6761\u6b3e",
  "\u5546\u52a1\u6761\u6b3e",
  "\u6280\u672f\u6761\u6b3e",
  "\u65f6\u95f4\u8282\u70b9",
  "\u6587\u4ef6\u5b8c\u6574\u6027",
  "\u5176\u4ed6",
]);

const chapterReviewSchema = z.object({
  chapter_title: z.string(),
  summary: z.string(),
  findings: z.array(
    z.object({
      title: z.string(),
      category: tenderCategoryEnum,
      risk: z.enum(["\u9ad8", "\u4e2d", "\u4f4e"]),
      description: z.string(),
      recommendation: z.string(),
      references: z.array(z.string()).default([]),
      sourceChunkIds: z.array(z.string()).default([]),
      regulationChunkIds: z.array(z.string()).default([]),
      needsHumanReview: z.boolean().default(true),
      confidence: z.number().min(0).max(1).default(0.5),
    }),
  ),
});

const crossScanSchema = z.object({
  conflicts: z.array(
    z.object({
      title: z.string(),
      risk: z.enum(["\u9ad8", "\u4e2d", "\u4f4e"]),
      description: z.string(),
      recommendation: z.string(),
      chapterA: z.string(),
      chapterB: z.string(),
      references: z.array(z.string()).default([]),
      sourceChunkIds: z.array(z.string()).default([]),
      needsHumanReview: z.boolean().default(true),
      confidence: z.number().min(0).max(1).default(0.5),
    }),
  ),
  summary: z.string().default(""),
});

const fallbackChapterTitlePrefix = "\u6587\u6863\u7247\u6bb5\u7ec4 ";
const chapterReviewSystemPrompt = [
  "You are a tender chapter review assistant.",
  "Detect compliance risks based only on the input chapter and regulation candidates.",
  "Use chapter chunks as the only source text context.",
  "If evidence is insufficient, return an empty findings array.",
  "Return valid JSON only.",
].join("\n");

const chapterReviewOutputContract = {
  chapter_title: "string",
  summary: "string",
  findings: [
    {
      title: "string",
      category:
        "\u8d44\u683c\u6761\u4ef6|\u8bc4\u6807\u529e\u6cd5|\u4fdd\u8bc1\u91d1\u6761\u6b3e|\u5546\u52a1\u6761\u6b3e|\u6280\u672f\u6761\u6b3e|\u65f6\u95f4\u8282\u70b9|\u6587\u4ef6\u5b8c\u6574\u6027|\u5176\u4ed6",
      risk: "\u9ad8|\u4e2d|\u4f4e",
      description: "string",
      recommendation: "string",
      references: ["string"],
      sourceChunkIds: ["string"],
      regulationChunkIds: ["string"],
      needsHumanReview: true,
      confidence: 0,
    },
  ],
} as const;

interface ChapterTokenBudgetConfig {
  targetMinTokens: number;
  targetMaxTokens: number;
  targetMidTokens: number;
  hardMaxTokens: number;
  tailMinTokens: number;
}

const defaultChapterTokenBudgetConfig: ChapterTokenBudgetConfig = {
  targetMinTokens: 8_000,
  targetMaxTokens: 12_000,
  targetMidTokens: 10_000,
  hardMaxTokens: 18_000,
  tailMinTokens: 6_000,
};

const strongChapterTitlePattern =
  /^\s*\u7b2c[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\d]+[\u7ae0\u8282][^\n]{0,50}/;
const weakChapterTitlePattern = /^\s*\d+\.(?!\d)\s*[^\n]{0,60}/;

const normalizeTitle = (text: string) => text.replace(/\s+/g, " ").trim();

const stripLeadingPageNumber = (text: string) => {
  const normalized = normalizeTitle(text);
  return normalized.replace(/^(\d+)\s+(?=(\u7b2c|\d+\.))/u, "");
};

const isTocNoise = (text: string) => {
  const normalized = normalizeTitle(text);
  if (normalized.length < 4) return true;
  if (normalized.includes("\u76ee\u5f55") && normalized.length <= 12) return true;
  if (/\.{3,}\s*\d+$/.test(normalized)) return true;
  if (/^\d+$/.test(normalized)) return true;
  if (/^\d+\.\d+/.test(normalized)) return true;
  return false;
};

const extractChapterHeading = (text: string): ChapterHeadingMatch | null => {
  const sanitized = stripLeadingPageNumber(text);

  const strongMatch = sanitized.match(strongChapterTitlePattern);
  if (strongMatch?.[0]) {
    const normalized = normalizeTitle(strongMatch[0]);
    if (!isTocNoise(normalized)) {
      return {
        level: "strong",
        title: normalized,
      };
    }
  }

  const weakMatch = sanitized.match(weakChapterTitlePattern);
  if (weakMatch?.[0]) {
    const normalized = normalizeTitle(weakMatch[0]);
    if (!isTocNoise(normalized)) {
      return {
        level: "weak",
        title: normalized,
      };
    }
  }

  return null;
};

const isFallbackChapterTitle = (title: string) => title.startsWith(fallbackChapterTitlePrefix);

const resolveMergedChapterTitle = (leftTitle: string, rightTitle: string) => {
  if (!isFallbackChapterTitle(leftTitle)) return leftTitle;
  if (!isFallbackChapterTitle(rightTitle)) return rightTitle;
  return leftTitle;
};

const estimatePageByChunkOrder = (document: DocumentRecord, chunkOrder: number) => {
  const totalChunks = Math.max(document.chunks.length, 1);
  return Math.max(1, Math.ceil((chunkOrder / totalChunks) * document.pageCount));
};

const buildPageRangeFromChunks = (document: DocumentRecord, chunks: DocumentChunk[]) => {
  const firstChunk = chunks[0];
  const lastChunk = chunks[chunks.length - 1];
  const startPage = estimatePageByChunkOrder(document, firstChunk.order);
  const endPage = estimatePageByChunkOrder(document, lastChunk.order);
  return startPage === endPage ? `\u7b2c ${startPage} \u9875` : `\u7b2c ${startPage}-${endPage} \u9875`;
};

const createTenderChapterFromChunks = (params: {
  document: DocumentRecord;
  title: string;
  chunks: DocumentChunk[];
}): TenderChapter => ({
  id: `${params.document.id}-chapter-${params.chunks[0].order}`,
  title: params.title,
  text: params.chunks.map((chunk) => chunk.text).join("\n"),
  chunks: params.chunks,
  pageRange: buildPageRangeFromChunks(params.document, params.chunks),
});

const estimatePromptTokensProxy = (value: string) => value.replace(/\s+/g, "").length;

const mergeAdjacentChapterDrafts = (
  left: TenderChapterDraft,
  right: TenderChapterDraft,
): TenderChapterDraft => ({
  startIndex: left.startIndex,
  title: resolveMergedChapterTitle(left.title, right.title),
  chunks: [...left.chunks, ...right.chunks],
});

const mergeDraftsAt = (drafts: TenderChapterDraft[], index: number) => {
  drafts[index] = mergeAdjacentChapterDrafts(drafts[index], drafts[index + 1]);
  drafts.splice(index + 1, 1);
};

export const extractTenderChapters = (document: DocumentRecord): TenderChapter[] => {
  if (document.chunks.length === 0) return [];

  const chapterDrafts: TenderChapterDraft[] = [];
  let current: TenderChapterDraft | null = null;

  document.chunks.forEach((chunk, index) => {
    const heading = extractChapterHeading(chunk.text);

    if (!current || heading) {
      if (current) chapterDrafts.push(current);

      current = {
        startIndex: index,
        title: heading?.title ?? `${fallbackChapterTitlePrefix}${chapterDrafts.length + 1}`,
        chunks: [chunk],
      };
      return;
    }

    current.chunks.push(chunk);
  });

  if (current) chapterDrafts.push(current);

  return chapterDrafts
    .filter((draft) => !isTocNoise(draft.title))
    .map((draft) =>
      createTenderChapterFromChunks({
        document,
        title: draft.title,
        chunks: draft.chunks,
      }),
    );
};

const buildRegulationCandidatesForChapter = (chapter: TenderChapter, regulations: Regulation[]) => {
  const candidates = chapter.chunks.flatMap((chunk) =>
    matchRegulationChunks({
      sourceChunk: chunk,
      regulations,
      preferredKeywords: [
        "\u4fdd\u8bc1\u91d1",
        "\u8d44\u683c",
        "\u8d44\u8d28",
        "\u8bc4\u6807",
        "\u8bc4\u5206",
        "\u9650\u5236",
        "\u6392\u65a5",
        "\u5de5\u671f",
        "\u5408\u540c",
        "\u6280\u672f",
      ],
      limit: 2,
    }),
  );

  const unique = new Map<string, (typeof candidates)[number]>();
  candidates.forEach((candidate) => {
    const key = `${candidate.regulation.id}:${candidate.chunk.id}`;
    if (!unique.has(key)) {
      unique.set(key, candidate);
    }
  });

  return Array.from(unique.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((candidate) => ({
      regulationName: candidate.regulation.name,
      regulationCategory: candidate.regulation.category,
      sectionTitle: candidate.chunk.sectionTitle,
      chunkId: candidate.chunk.id,
      text: candidate.chunk.text,
      matchedKeywords: candidate.matchedKeywords,
    }));
};

const buildChapterMetadataSummary = (document: DocumentRecord) => ({
  filename: document.originalName,
  pageCount: document.pageCount,
  textPreview: document.textPreview,
  topChunks: document.chunks.slice(0, 5).map((chunk) => ({
    id: chunk.id,
    order: chunk.order,
    text: chunk.text,
  })),
});

export const estimateChapterPromptTokensProxy = (params: {
  chapter: TenderChapter;
  document: DocumentRecord;
  regulations: Regulation[];
}) => {
  const regulationCandidates = buildRegulationCandidatesForChapter(params.chapter, params.regulations);
  const userPrompt = JSON.stringify(
    {
      metadata: buildChapterMetadataSummary(params.document),
      chapter: {
        id: params.chapter.id,
        title: params.chapter.title,
        pageRange: params.chapter.pageRange,
        chunks: params.chapter.chunks,
      },
      regulationCandidates,
      outputContract: chapterReviewOutputContract,
    },
    null,
    2,
  );

  return estimatePromptTokensProxy(`${chapterReviewSystemPrompt}\n${userPrompt}`);
};

const mergeTwoTenderChapters = (
  document: DocumentRecord,
  left: TenderChapter,
  right: TenderChapter,
): TenderChapter =>
  createTenderChapterFromChunks({
    document,
    title: resolveMergedChapterTitle(left.title, right.title),
    chunks: [...left.chunks, ...right.chunks],
  });

const splitTenderChapterByBudget = (params: {
  chapter: TenderChapter;
  document: DocumentRecord;
  estimateTokens: (chapter: TenderChapter) => number;
  targetMaxTokens: number;
  hardMaxTokens: number;
}) => {
  if (params.chapter.chunks.length <= 1) {
    return [params.chapter];
  }

  const roughParts: TenderChapter[] = [];
  let buffer: DocumentChunk[] = [];

  for (const chunk of params.chapter.chunks) {
    const nextBuffer = [...buffer, chunk];
    const nextCandidate = createTenderChapterFromChunks({
      document: params.document,
      title: params.chapter.title,
      chunks: nextBuffer,
    });

    if (buffer.length > 0 && params.estimateTokens(nextCandidate) > params.targetMaxTokens) {
      roughParts.push(
        createTenderChapterFromChunks({
          document: params.document,
          title: params.chapter.title,
          chunks: buffer,
        }),
      );
      buffer = [chunk];
      continue;
    }

    buffer = nextBuffer;
  }

  if (buffer.length > 0) {
    roughParts.push(
      createTenderChapterFromChunks({
        document: params.document,
        title: params.chapter.title,
        chunks: buffer,
      }),
    );
  }

  const hardLimitedParts: TenderChapter[] = [];
  for (const part of roughParts) {
    if (params.estimateTokens(part) <= params.hardMaxTokens || part.chunks.length <= 1) {
      hardLimitedParts.push(part);
      continue;
    }

    const queue: TenderChapter[] = [part];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (params.estimateTokens(current) <= params.hardMaxTokens || current.chunks.length <= 1) {
        hardLimitedParts.push(current);
        continue;
      }

      const mid = Math.ceil(current.chunks.length / 2);
      const leftPart = createTenderChapterFromChunks({
        document: params.document,
        title: current.title,
        chunks: current.chunks.slice(0, mid),
      });
      const rightPart = createTenderChapterFromChunks({
        document: params.document,
        title: current.title,
        chunks: current.chunks.slice(mid),
      });
      queue.unshift(rightPart);
      queue.unshift(leftPart);
    }
  }

  if (hardLimitedParts.length <= 1) {
    return hardLimitedParts;
  }

  return hardLimitedParts.map((part, index) =>
    index === 0
      ? part
      : createTenderChapterFromChunks({
          document: params.document,
          title: `${params.chapter.title} (part ${index + 1})`,
          chunks: part.chunks,
        }),
  );
};

export const rebalanceChaptersByTokenBudget = (params: {
  chapters: TenderChapter[];
  document: DocumentRecord;
  regulations: Regulation[];
  estimateTokens?: (chapter: TenderChapter) => number;
  config?: Partial<ChapterTokenBudgetConfig>;
}) => {
  if (params.chapters.length === 0) {
    return params.chapters;
  }

  const budget: ChapterTokenBudgetConfig = {
    ...defaultChapterTokenBudgetConfig,
    ...params.config,
  };

  const estimateTokens =
    params.estimateTokens ??
    ((chapter: TenderChapter) =>
      estimateChapterPromptTokensProxy({
        chapter,
        document: params.document,
        regulations: params.regulations,
      }));

  const chapters = params.chapters.map((chapter) =>
    createTenderChapterFromChunks({
      document: params.document,
      title: chapter.title,
      chunks: chapter.chunks,
    }),
  );

  let index = 0;
  while (index < chapters.length) {
    const chapter = chapters[index];
    if (estimateTokens(chapter) <= budget.targetMaxTokens || chapter.chunks.length <= 1) {
      index += 1;
      continue;
    }

    const splitParts = splitTenderChapterByBudget({
      chapter,
      document: params.document,
      estimateTokens,
      targetMaxTokens: budget.targetMaxTokens,
      hardMaxTokens: budget.hardMaxTokens,
    });

    if (splitParts.length <= 1) {
      index += 1;
      continue;
    }

    chapters.splice(index, 1, ...splitParts);
    index += splitParts.length;
  }

  let guard = 0;
  const mergeGuardLimit = Math.max(10, chapters.length * 5);
  while (chapters.length > 1 && guard < mergeGuardLimit) {
    guard += 1;
    let changed = false;

    for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex += 1) {
      const current = chapters[chapterIndex];
      const currentTokens = estimateTokens(current);
      if (currentTokens >= budget.targetMinTokens) {
        continue;
      }

      const candidates: Array<{
        mergeStartIndex: number;
        merged: TenderChapter;
        mergedTokens: number;
      }> = [];

      if (chapterIndex > 0) {
        const merged = mergeTwoTenderChapters(params.document, chapters[chapterIndex - 1], current);
        candidates.push({
          mergeStartIndex: chapterIndex - 1,
          merged,
          mergedTokens: estimateTokens(merged),
        });
      }

      if (chapterIndex < chapters.length - 1) {
        const merged = mergeTwoTenderChapters(params.document, current, chapters[chapterIndex + 1]);
        candidates.push({
          mergeStartIndex: chapterIndex,
          merged,
          mergedTokens: estimateTokens(merged),
        });
      }

      if (candidates.length === 0) {
        continue;
      }

      const withinHardMax = candidates.filter((candidate) => candidate.mergedTokens <= budget.hardMaxTokens);
      const pool = withinHardMax.length > 0 ? withinHardMax : candidates;
      pool.sort((left, right) => {
        const leftPenalty =
          left.mergedTokens <= budget.targetMaxTokens ? 0 : (left.mergedTokens - budget.targetMaxTokens) + 100_000;
        const rightPenalty =
          right.mergedTokens <= budget.targetMaxTokens
            ? 0
            : (right.mergedTokens - budget.targetMaxTokens) + 100_000;
        const leftScore = leftPenalty + Math.abs(left.mergedTokens - budget.targetMidTokens);
        const rightScore = rightPenalty + Math.abs(right.mergedTokens - budget.targetMidTokens);

        if (leftScore !== rightScore) {
          return leftScore - rightScore;
        }
        return left.mergedTokens - right.mergedTokens;
      });

      const best = pool[0];
      chapters.splice(best.mergeStartIndex, 2, best.merged);
      changed = true;
      break;
    }

    if (!changed) {
      break;
    }
  }

  if (chapters.length > 1) {
    const tailIndex = chapters.length - 1;
    const tail = chapters[tailIndex];
    if (estimateTokens(tail) < budget.tailMinTokens) {
      const mergedTail = mergeTwoTenderChapters(params.document, chapters[tailIndex - 1], tail);
      if (estimateTokens(mergedTail) <= budget.hardMaxTokens) {
        chapters.splice(tailIndex - 1, 2, mergedTail);
      }
    }
  }

  index = 0;
  while (index < chapters.length) {
    const chapter = chapters[index];
    if (estimateTokens(chapter) <= budget.hardMaxTokens || chapter.chunks.length <= 1) {
      index += 1;
      continue;
    }

    const splitParts = splitTenderChapterByBudget({
      chapter,
      document: params.document,
      estimateTokens,
      targetMaxTokens: budget.hardMaxTokens,
      hardMaxTokens: budget.hardMaxTokens,
    });

    if (splitParts.length <= 1) {
      index += 1;
      continue;
    }

    chapters.splice(index, 1, ...splitParts);
    index += splitParts.length;
  }

  return chapters;
};

const reviewTenderChapter = async (
  chapter: TenderChapter,
  document: DocumentRecord,
  regulations: Regulation[],
  taskId: string,
  seed?: number,
  signal?: AbortSignal,
) => {
  let hadRateLimitRetry = false;
  const regulationCandidates = buildRegulationCandidatesForChapter(chapter, regulations);

  const review = chapterReviewSchema.parse(
    await requestStructuredAiReview<unknown>({
      systemPrompt: chapterReviewSystemPrompt,
      userPrompt: JSON.stringify(
        {
          metadata: buildChapterMetadataSummary(document),
          chapter: {
            id: chapter.id,
            title: chapter.title,
            pageRange: chapter.pageRange,
            chunks: chapter.chunks,
          },
          regulationCandidates,
          outputContract: chapterReviewOutputContract,
        },
        null,
        2,
      ),
      seed,
      signal,
      taskId,
      onRetry: (event: AiRetryEvent) => {
        if (event.rateLimited) {
          hadRateLimitRetry = true;
        }
      },
    }),
  );

  return {
    review,
    hadRateLimitRetry,
  };
};

const buildCrossSectionPairs = (chapters: TenderChapter[]) => {
  const pairs: Array<{ a: TenderChapter; b: TenderChapter }> = [];

  for (let index = 0; index < Math.min(chapters.length - 1, 4); index += 1) {
    pairs.push({ a: chapters[index], b: chapters[index + 1] });
  }

  return pairs;
};

const runCrossSectionScan = async (
  chapters: TenderChapter[],
  document: DocumentRecord,
  taskId: string,
  seed?: number,
  signal?: AbortSignal,
) => {
  const pairs = buildCrossSectionPairs(chapters).map((pair) => ({
    chapterA: { title: pair.a.title, text: pair.a.text, chunkIds: pair.a.chunks.map((chunk) => chunk.id) },
    chapterB: { title: pair.b.title, text: pair.b.text, chunkIds: pair.b.chunks.map((chunk) => chunk.id) },
  }));

  return crossScanSchema.parse(
    await requestStructuredAiReview<unknown>({
      systemPrompt: [
        "You are a cross-section consistency review assistant for tender documents.",
        "Find contradictions and execution risks between chapter pairs.",
        "If evidence is insufficient, return empty conflicts.",
        "Return valid JSON only.",
      ].join("\n"),
      userPrompt: JSON.stringify(
        {
          metadata: buildChapterMetadataSummary(document),
          chapterPairs: pairs,
          outputContract: {
            conflicts: [
              {
                title: "string",
                risk: "\u9ad8|\u4e2d|\u4f4e",
                description: "string",
                recommendation: "string",
                chapterA: "string",
                chapterB: "string",
                references: ["string"],
                sourceChunkIds: ["string"],
                needsHumanReview: true,
                confidence: 0,
              },
            ],
            summary: "string",
          },
        },
        null,
        2,
      ),
      seed,
      signal,
      taskId,
    }),
  );
};

export const generateTenderChapterAiFindings = async (params: {
  projectId: string;
  taskId: string;
  tenderDocument: DocumentRecord;
  regulations: Regulation[];
  chapterConcurrency?: {
    initial: number;
    min: number;
  };
  runtimeMetricsProvider?: () => {
    rssBytes: number;
    eventLoopLagMs: number;
  };
  seed?: number;
  signal?: AbortSignal;
  onProgress?: (payload: {
    current: number;
    total: number;
    chapterTitle: string;
    stage: "chapter_review" | "cross_scan";
  }) => void;
}): Promise<{ findings: Finding[] }> => {
  const extractedChapters = extractTenderChapters(params.tenderDocument);
  if (extractedChapters.length === 0) return { findings: [] };

  const chapters = rebalanceChaptersByTokenBudget({
    chapters: extractedChapters,
    document: params.tenderDocument,
    regulations: params.regulations,
  });

  const chapterConcurrency = params.chapterConcurrency ?? {
    initial: 3,
    min: 2,
  };

  const concurrencyController = createReviewChapterConcurrencyController({
    initialConcurrency: chapterConcurrency.initial,
    minConcurrency: chapterConcurrency.min,
    getRuntimeMetrics: params.runtimeMetricsProvider,
  });

  const chapterFindings: Finding[] = [];
  await runWithAdaptiveChapterConcurrency({
    items: chapters,
    controller: concurrencyController,
    signal: params.signal,
    worker: ({ item, signal }) =>
      reviewTenderChapter(item, params.tenderDocument, params.regulations, params.taskId, params.seed, signal),
    getSuccessMetrics: (result) => ({
      hadRateLimitRetry: result.hadRateLimitRetry,
    }),
    collectResults: false,
    onItemSuccess: ({ result }) => {
      chapterFindings.push(
        ...result.review.findings.map((finding) => ({
          id: createId("finding"),
          projectId: params.projectId,
          taskId: params.taskId,
          title: finding.title,
          category: finding.category as TenderFindingCategory,
          risk: finding.risk,
          status: "\u5f85\u590d\u6838",
          location: result.review.chapter_title,
          description: finding.description,
          recommendation: finding.recommendation,
          references: finding.references,
          sourceChunkIds: finding.sourceChunkIds,
          candidateChunkIds: [],
          regulationChunkIds: finding.regulationChunkIds,
          needsHumanReview: finding.needsHumanReview,
          confidence: finding.confidence,
          reviewStage: "chapter_review",
          scenario: "tender_compliance",
          reviewLogs: [],
          createdAt: nowIso(),
        }) as Finding),
      );
    },
    onItemCompleted: ({ item, completed, total }) => {
      params.onProgress?.({
        current: completed,
        total,
        chapterTitle: item.title,
        stage: "chapter_review",
      });
    },
  });

  params.onProgress?.({
    current: chapters.length,
    total: chapters.length,
    chapterTitle: "\u8de8\u7ae0\u8282\u4e00\u81f4\u6027\u68c0\u67e5",
    stage: "cross_scan",
  });

  const crossScan = await runCrossSectionScan(
    chapters,
    params.tenderDocument,
    params.taskId,
    params.seed,
    params.signal,
  ).catch(() => ({
    conflicts: [],
    summary: "",
  }));

  const crossFindings = crossScan.conflicts.map((conflict) =>
    ({
      id: createId("finding"),
      projectId: params.projectId,
      taskId: params.taskId,
      title: conflict.title,
      category: "\u5176\u4ed6",
      risk: conflict.risk,
      status: "\u5f85\u590d\u6838",
      location: `${conflict.chapterA} / ${conflict.chapterB}`,
      description: conflict.description,
      recommendation: conflict.recommendation,
      references: conflict.references,
      sourceChunkIds: conflict.sourceChunkIds,
      candidateChunkIds: [],
      regulationChunkIds: [],
      needsHumanReview: conflict.needsHumanReview,
      confidence: conflict.confidence,
      reviewStage: "cross_section_review",
      scenario: "tender_compliance",
      reviewLogs: [],
      createdAt: nowIso(),
    }) as Finding,
  );

  return {
    findings: [...chapterFindings, ...crossFindings],
  };
};
