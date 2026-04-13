import { describe, expect, it, vi } from "vitest";
import type { DocumentRecord } from "../../server/types";
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
