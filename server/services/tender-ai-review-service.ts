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

const chapterTitlePatterns = [
  /^\s*\u7b2c[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\d]+[\u7ae0\u8282][^\n]{0,50}/,
  /^\s*\d+\.(?!\d)\s*[^\n]{0,60}/,
  /^\s*[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+[\u3001\.\uff0e]\s*[^\n]{0,60}/,
];

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

const extractChapterTitle = (text: string) => {
  const sanitized = stripLeadingPageNumber(text);

  for (const pattern of chapterTitlePatterns) {
    const match = sanitized.match(pattern);
    if (!match?.[0]) continue;

    const normalized = normalizeTitle(match[0]);
    if (!isTocNoise(normalized)) {
      return normalized;
    }
  }

  return null;
};

export const extractTenderChapters = (document: DocumentRecord): TenderChapter[] => {
  if (document.chunks.length === 0) return [];

  const totalChunks = Math.max(document.chunks.length, 1);
  const estimatePage = (chunkOrder: number) => Math.max(1, Math.ceil((chunkOrder / totalChunks) * document.pageCount));

  const chapters: TenderChapter[] = [];
  let current: TenderChapter | null = null;

  document.chunks.forEach((chunk, index) => {
    const title = extractChapterTitle(chunk.text);

    if (!current || title) {
      if (current) chapters.push(current);

      current = {
        id: `${document.id}-chapter-${index + 1}`,
        title: title ?? `\u6587\u6863\u7247\u6bb5\u7ec4 ${chapters.length + 1}`,
        text: chunk.text,
        chunks: [chunk],
        pageRange: `\u7b2c ${estimatePage(chunk.order)} \u9875`,
      };
      return;
    }

    current.text += `\n${chunk.text}`;
    current.chunks.push(chunk);
  });

  if (current) chapters.push(current);

  return chapters.filter((chapter) => !isTocNoise(chapter.title));
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

const reviewTenderChapter = async (
  chapter: TenderChapter,
  document: DocumentRecord,
  regulations: Regulation[],
  seed?: number,
  signal?: AbortSignal,
) => {
  let hadRateLimitRetry = false;
  const regulationCandidates = buildRegulationCandidatesForChapter(chapter, regulations);

  const review = chapterReviewSchema.parse(
    await requestStructuredAiReview<unknown>({
      systemPrompt: [
        "You are a tender chapter review assistant.",
        "Detect compliance risks based only on the input chapter and regulation candidates.",
        "If evidence is insufficient, return an empty findings array.",
        "Return valid JSON only.",
      ].join("\n"),
      userPrompt: JSON.stringify(
        {
          metadata: buildChapterMetadataSummary(document),
          chapter: {
            id: chapter.id,
            title: chapter.title,
            pageRange: chapter.pageRange,
            chunks: chapter.chunks,
            text: chapter.text,
          },
          regulationCandidates,
          outputContract: {
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
          },
        },
        null,
        2,
      ),
      seed,
      signal,
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
  seed?: number;
  signal?: AbortSignal;
  onProgress?: (payload: {
    current: number;
    total: number;
    chapterTitle: string;
    stage: "chapter_review" | "cross_scan";
  }) => void;
}): Promise<{ findings: Finding[] }> => {
  const chapters = extractTenderChapters(params.tenderDocument);
  if (chapters.length === 0) return { findings: [] };

  const chapterConcurrency = params.chapterConcurrency ?? {
    initial: 3,
    min: 2,
  };

  const concurrencyController = createReviewChapterConcurrencyController({
    initialConcurrency: chapterConcurrency.initial,
    minConcurrency: chapterConcurrency.min,
  });

  const chapterResults = await runWithAdaptiveChapterConcurrency({
    items: chapters,
    controller: concurrencyController,
    signal: params.signal,
    worker: ({ item, signal }) =>
      reviewTenderChapter(item, params.tenderDocument, params.regulations, params.seed, signal),
    getSuccessMetrics: (result) => ({
      hadRateLimitRetry: result.hadRateLimitRetry,
    }),
    onItemCompleted: ({ item, completed, total }) => {
      params.onProgress?.({
        current: completed,
        total,
        chapterTitle: item.title,
        stage: "chapter_review",
      });
    },
  });

  const chapterFindings = chapterResults.flatMap((result) =>
    result.review.findings.map((finding) => ({
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

  params.onProgress?.({
    current: chapters.length,
    total: chapters.length,
    chapterTitle: "\u8de8\u7ae0\u8282\u4e00\u81f4\u6027\u68c0\u67e5",
    stage: "cross_scan",
  });

  const crossScan = await runCrossSectionScan(chapters, params.tenderDocument, params.seed, params.signal).catch(
    () => ({
      conflicts: [],
      summary: "",
    }),
  );

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