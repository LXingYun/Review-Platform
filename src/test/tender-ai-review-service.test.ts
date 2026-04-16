import { afterEach, describe, expect, it, vi } from "vitest";
import type { DocumentRecord, Regulation } from "../../server/types";
import {
  extractTenderChapters,
  generateTenderChapterAiFindings,
  rebalanceChaptersByTokenBudget,
} from "../../server/services/tender-ai-review-service";

const createDocument = (chunkTexts: string[]): DocumentRecord => ({
  id: "doc-test",
  projectId: "project-test",
  fileName: "tender.txt",
  originalName: "tender.txt",
  mimeType: "text/plain",
  sizeBytes: chunkTexts.join("\n").length,
  role: "tender",
  storagePath: "C:\\temp\\tender.txt",
  parseStatus: "\u5df2\u5b8c\u6210",
  pageCount: 20,
  parseMethod: "plain-text",
  textPreview: chunkTexts[0] ?? "",
  extractedText: chunkTexts.join("\n"),
  chunks: chunkTexts.map((text, index) => ({
    id: `chunk-${index + 1}`,
    order: index + 1,
    text,
  })),
  uploadedAt: new Date().toISOString(),
});

const createRegulation = (chunkTexts: string[]): Regulation => ({
  id: "reg-test",
  name: "示例法规",
  category: "法律",
  ruleCount: chunkTexts.length,
  updated: "2024-01-01",
  textPreview: chunkTexts[0] ?? "",
  chunks: chunkTexts.map((text, index) => ({
    id: `reg-chunk-${index + 1}`,
    order: index + 1,
    text,
  })),
  sections: [
    {
      title: "示例章节",
      rules: chunkTexts.length,
    },
  ],
});

const chapterReviewSystemPromptForTest = [
  "You are a tender chapter review assistant.",
  "Detect compliance risks based only on the input chapter and regulation candidates.",
  "Use chapter chunks as the only source text context.",
  "If evidence is insufficient, return an empty findings array.",
  "Return valid JSON only.",
].join("\n");

const chapterReviewOutputContractForTest = {
  chapter_title: "string",
  summary: "string",
  findings: [
    {
      title: "string",
      category: "资格条件|评标办法|保证金条款|商务条款|技术条款|时间节点|文件完整性|其他",
      risk: "高|中|低",
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

const buildChapterMetadataSummaryForTest = (document: DocumentRecord) => ({
  filename: document.originalName,
  pageCount: document.pageCount,
  textPreview: document.textPreview,
  topChunks: document.chunks.slice(0, 5).map((chunk) => ({
    id: chunk.id,
    order: chunk.order,
    text: chunk.text,
  })),
});

const countNonWhitespace = (value: string) => value.replace(/\s+/g, "").length;

const estimateChapterPromptTokensNaively = (params: {
  chapter: ReturnType<typeof extractTenderChapters>[number];
  document: DocumentRecord;
}) =>
  countNonWhitespace(
    `${chapterReviewSystemPromptForTest}\n${JSON.stringify(
      {
        metadata: buildChapterMetadataSummaryForTest(params.document),
        chapter: {
          id: params.chapter.id,
          title: params.chapter.title,
          pageRange: params.chapter.pageRange,
          chunks: params.chapter.chunks,
        },
        regulationCandidates: [],
        outputContract: chapterReviewOutputContractForTest,
      },
      null,
      2,
    )}`,
  );

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.doUnmock("../../server/services/regulation-match-service");
});

describe("extractTenderChapters", () => {
  it("splits by strong chapter headings", () => {
    const document = createDocument([
      "\u7b2c1\u7ae0 \u603b\u5219",
      "\u9996\u7ae0\u5185\u5bb9-1",
      "\u9996\u7ae0\u5185\u5bb9-2",
      "\u7b2c2\u7ae0 \u8d44\u683c\u6761\u4ef6",
      "\u7ae0\u8282\u5185\u5bb9-1",
      "\u7ae0\u8282\u5185\u5bb9-2",
    ]);

    const chapters = extractTenderChapters(document);
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toContain("\u7b2c1\u7ae0");
    expect(chapters[1].title).toContain("\u7b2c2\u7ae0");
  });

  it("does not split on chinese numbered clauses", () => {
    const document = createDocument([
      "\u4e00\u3001\u603b\u5219",
      "\u8981\u6c42A",
      "\u4e8c\u3001\u6295\u6807\u4eba\u8d44\u683c",
      "\u8981\u6c42B",
      "\u4e09\u3001\u5546\u52a1\u6761\u6b3e",
      "\u8981\u6c42C",
    ]);

    const chapters = extractTenderChapters(document);
    expect(chapters).toHaveLength(1);
  });

  it("rebalances small units toward the token budget by merging", () => {
    const chunkTexts: string[] = [];
    for (let index = 1; index <= 12; index += 1) {
      chunkTexts.push(`${index}. \u6761\u6b3e ${index}`);
      chunkTexts.push(`\u7ec6\u5219${index}`);
    }

    const document = createDocument(chunkTexts);
    const extracted = extractTenderChapters(document);
    const estimateByChunkChars = (chapter: { chunks: Array<{ text: string }> }) =>
      chapter.chunks.reduce((sum, chunk) => sum + chunk.text.replace(/\s+/g, "").length, 0);
    const rebalanced = rebalanceChaptersByTokenBudget({
      chapters: extracted,
      document,
      regulations: [],
      estimateTokens: estimateByChunkChars,
      config: {
        targetMinTokens: 25,
        targetMaxTokens: 70,
        targetMidTokens: 45,
        hardMaxTokens: 90,
        tailMinTokens: 18,
      },
    });

    expect(rebalanced.length).toBeLessThan(extracted.length);
    const inRange = rebalanced.filter((chapter) => {
      const tokens = estimateByChunkChars(chapter);
      return tokens >= 25 && tokens <= 70;
    }).length;
    expect(inRange).toBeGreaterThanOrEqual(Math.ceil(rebalanced.length * 0.7));
  });

  it("splits oversized units on chunk boundaries", () => {
    const document = createDocument([
      "\u8d77\u59cb\u5185\u5bb9",
      "aaaaaaaaaa",
      "bbbbbbbbbb",
      "cccccccccc",
      "dddddddddd",
      "eeeeeeeeee",
      "ffffffffff",
      "gggggggggg",
      "hhhhhhhhhh",
      "iiiiiiiiii",
    ]);

    const extracted = extractTenderChapters(document);
    expect(extracted).toHaveLength(1);

    const estimateByChunkChars = (chapter: { chunks: Array<{ text: string }> }) =>
      chapter.chunks.reduce((sum, chunk) => sum + chunk.text.replace(/\s+/g, "").length, 0);

    const rebalanced = rebalanceChaptersByTokenBudget({
      chapters: extracted,
      document,
      regulations: [],
      estimateTokens: estimateByChunkChars,
      config: {
        targetMinTokens: 20,
        targetMaxTokens: 35,
        targetMidTokens: 28,
        hardMaxTokens: 50,
        tailMinTokens: 15,
      },
    });

    expect(rebalanced.length).toBeGreaterThan(1);
    expect(rebalanced.every((chapter) => estimateByChunkChars(chapter) <= 50 || chapter.chunks.length === 1)).toBe(
      true,
    );

    const beforeIds = extracted.flatMap((chapter) => chapter.chunks.map((chunk) => chunk.id));
    const afterIds = rebalanced.flatMap((chapter) => chapter.chunks.map((chunk) => chunk.id));
    expect(afterIds).toEqual(beforeIds);
  });

  it("merges tiny tail units when merge stays within hard max", () => {
    const document = createDocument([
      "\u7b2c1\u7ae0 A",
      "aaaaaaaaaa",
      "aaaaaaaaaa",
      "aaaaaaaaaa",
      "\u7b2c2\u7ae0 B",
      "bbbbbbbbbb",
      "bbbbbbbbbb",
      "bbbbbbbbbb",
      "\u7b2c3\u7ae0 C",
      "c",
    ]);

    const extracted = extractTenderChapters(document);
    expect(extracted).toHaveLength(3);

    const estimateByChunkChars = (chapter: { chunks: Array<{ text: string }> }) =>
      chapter.chunks.reduce((sum, chunk) => sum + chunk.text.replace(/\s+/g, "").length, 0);

    const rebalanced = rebalanceChaptersByTokenBudget({
      chapters: extracted,
      document,
      regulations: [],
      estimateTokens: estimateByChunkChars,
      config: {
        targetMinTokens: 25,
        targetMaxTokens: 70,
        targetMidTokens: 45,
        hardMaxTokens: 100,
        tailMinTokens: 20,
      },
    });

    expect(rebalanced).toHaveLength(2);
    expect(estimateByChunkChars(rebalanced[rebalanced.length - 1])).toBeGreaterThanOrEqual(20);
  });

  it("keeps rebalance decisions when using the injected chapter estimator", async () => {
    const { createTenderChapterPromptEstimator } = await import(
      "../../server/services/tender-chapter-estimator-service"
    );

    const chunkTexts: string[] = [];
    for (let index = 1; index <= 18; index += 1) {
      chunkTexts.push(`${index}. 条款 ${index}`);
      chunkTexts.push(`细则 ${index} 需要说明的内容`);
    }

    const document = createDocument(chunkTexts);
    const extracted = extractTenderChapters(document);
    const estimator = createTenderChapterPromptEstimator({
      document,
      regulations: [],
      systemPrompt: chapterReviewSystemPromptForTest,
      metadata: buildChapterMetadataSummaryForTest(document),
      outputContract: chapterReviewOutputContractForTest,
    });
    const config = {
      targetMinTokens: 90,
      targetMaxTokens: 180,
      targetMidTokens: 140,
      hardMaxTokens: 220,
      tailMinTokens: 70,
    };

    const baseline = rebalanceChaptersByTokenBudget({
      chapters: extracted,
      document,
      regulations: [],
      estimateTokens: (chapter) => estimateChapterPromptTokensNaively({ chapter, document }),
      config,
    });
    const optimized = rebalanceChaptersByTokenBudget({
      chapters: extracted,
      document,
      regulations: [],
      estimateTokens: estimator,
      config,
    });

    expect(optimized.map((chapter) => chapter.chunks.map((chunk) => chunk.id))).toEqual(
      baseline.map((chapter) => chapter.chunks.map((chunk) => chunk.id)),
    );
  });

  it("caches repeated chapter span estimates", async () => {
    const { createTenderChapterPromptEstimator } = await import(
      "../../server/services/tender-chapter-estimator-service"
    );

    const document = createDocument([
      "第1章 总则",
      "首章内容 1",
      "首章内容 2",
      "首章内容 3",
    ]);
    const chapter = extractTenderChapters(document)[0];
    const estimator = createTenderChapterPromptEstimator({
      document,
      regulations: [],
      systemPrompt: chapterReviewSystemPromptForTest,
      metadata: buildChapterMetadataSummaryForTest(document),
      outputContract: chapterReviewOutputContractForTest,
    });
    const stringifySpy = vi.spyOn(JSON, "stringify");

    estimator(chapter);
    const firstPassStringifyCalls = stringifySpy.mock.calls.length;

    estimator(chapter);

    expect(stringifySpy.mock.calls.length).toBe(firstPassStringifyCalls);
  });

  it("does not repeat regulation matching for large chapter estimation", async () => {
    const actualModule = await vi.importActual<typeof import("../../server/services/regulation-match-service")>(
      "../../server/services/regulation-match-service"
    );
    const matchRegulationChunksMock = vi.fn(actualModule.matchRegulationChunks);

    vi.doMock("../../server/services/regulation-match-service", () => ({
      ...actualModule,
      matchRegulationChunks: matchRegulationChunksMock,
    }));

    const { createTenderChapterPromptEstimator } = await import(
      "../../server/services/tender-chapter-estimator-service"
    );

    const chunkTexts = Array.from({ length: 24 }, (_, index) => `资格要求条款 ${index + 1} 与保证金说明`);
    const document = createDocument(chunkTexts);
    const chapter = extractTenderChapters(document)[0];
    const estimator = createTenderChapterPromptEstimator({
      document,
      regulations: [
        createRegulation([
          "资格条件不得排斥潜在投标人。",
          "保证金比例应当符合法规要求。",
          "评标办法应当公开透明。",
        ]),
      ],
      systemPrompt: chapterReviewSystemPromptForTest,
      metadata: buildChapterMetadataSummaryForTest(document),
      outputContract: chapterReviewOutputContractForTest,
    });

    expect(matchRegulationChunksMock).toHaveBeenCalledTimes(document.chunks.length);

    estimator(chapter);
    estimator(chapter);
    estimator({
      ...chapter,
      title: `${chapter.title} (copy)`,
      chunks: chapter.chunks.slice(0, chapter.chunks.length - 1),
    });

    expect(matchRegulationChunksMock).toHaveBeenCalledTimes(document.chunks.length);
  });

  it("uses chunks-only chapter payload for chapter review prompt", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const payload = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      const messageText = payload?.messages?.[1]?.content;

      if (typeof messageText === "string" && messageText.includes("cross-section consistency review assistant")) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ conflicts: [], summary: "" }) } }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  chapter_title: "测试章节",
                  summary: "",
                  findings: [],
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_BASE_URL = "https://example.test";
    process.env.OPENAI_MODEL = "test-model";

    const document = createDocument([
      "\u7b2c1\u7ae0 \u603b\u5219",
      "\u9996\u7ae0\u5185\u5bb9-1",
      "\u9996\u7ae0\u5185\u5bb9-2",
      "\u7b2c2\u7ae0 \u8d44\u683c\u6761\u4ef6",
      "\u7b2c\u4e8c\u7ae0\u5185\u5bb9-1",
      "\u7b2c\u4e8c\u7ae0\u5185\u5bb9-2",
    ]);

    await generateTenderChapterAiFindings({
      projectId: "project-test",
      taskId: "task-test",
      tenderDocument: document,
      regulations: [],
      chapterConcurrency: {
        initial: 1,
        min: 1,
      },
    });

    const firstCall = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const firstPayload = typeof firstCall?.body === "string" ? JSON.parse(firstCall.body) : {};
    const userPromptRaw = firstPayload?.messages?.[1]?.content;
    expect(typeof userPromptRaw).toBe("string");

    const userPrompt =
      typeof userPromptRaw === "string" ? (JSON.parse(userPromptRaw) as { chapter?: Record<string, unknown> }) : {};
    expect(userPrompt.chapter).toBeTruthy();
    expect(userPrompt.chapter?.chunks).toBeTruthy();
    expect(userPrompt.chapter?.text).toBeUndefined();
  });
});
