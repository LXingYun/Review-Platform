import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("resolveReviewExecutionMode", () => {
  const originalCwd = process.cwd();
  const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
  const originalOpenAiBaseUrl = process.env.OPENAI_BASE_URL;
  let tempDir = "";

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-service-test-"));
    process.chdir(tempDir);
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_BASE_URL = "https://example.test";
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.chdir(originalCwd);
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // node:sqlite may still hold the temp db file open briefly on Windows.
    }

    if (originalOpenAiApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiApiKey;
    }

    if (originalOpenAiBaseUrl === undefined) {
      delete process.env.OPENAI_BASE_URL;
    } else {
      process.env.OPENAI_BASE_URL = originalOpenAiBaseUrl;
    }
  });

  it("uses AI when AI is enabled", async () => {
    const { resolveReviewExecutionMode } = await import("../../server/services/review-service");

    expect(
      resolveReviewExecutionMode({
        aiEnabled: true,
      }),
    ).toBe("ai");
  });

  it("blocks review instead of falling back to local rules when AI is disabled", async () => {
    const { resolveReviewExecutionMode } = await import("../../server/services/review-service");

    expect(
      resolveReviewExecutionMode({
        aiEnabled: false,
      }),
    ).toBe("blocked");
  });

  it("does not restore findings after deleting a running task", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    findings: [
                      {
                        title: "商务响应缺失",
                        category: "商务响应",
                        risk: "中",
                        location: "招标片段 1",
                        description: "测试问题",
                        recommendation: "补充说明",
                        references: ["测试依据"],
                        sourceChunkIds: ["doc-t-chunk-1"],
                        candidateChunkIds: ["doc-b-chunk-1"],
                        regulationChunkIds: [],
                        needsHumanReview: true,
                        confidence: 0.9,
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      ),
    );

    const { store } = await import("../../server/store");
    const { createProject } = await import("../../server/services/project-service");
    const { createReviewTask, deleteReviewTask, initializeReviewWorkers } = await import(
      "../../server/services/review-service"
    );

    const project = createProject({
      name: "测试项目",
      type: "投标审查",
      description: "",
    });

    store.update((current) => ({
      ...current,
      documents: [
        {
          id: "doc-t",
          projectId: project.id,
          fileName: "tender.txt",
          originalName: "tender.txt",
          mimeType: "text/plain",
          sizeBytes: 10,
          role: "tender",
          storagePath: path.join(tempDir, "tender.txt"),
          parseStatus: "已完成",
          pageCount: 1,
          parseMethod: "plain-text",
          textPreview: "付款要求",
          extractedText: "付款要求 资质 技术",
          chunks: [{ id: "doc-t-chunk-1", order: 1, text: "付款要求 资质 技术" }],
          uploadedAt: new Date().toISOString(),
        },
        {
          id: "doc-b",
          projectId: project.id,
          fileName: "bid.txt",
          originalName: "bid.txt",
          mimeType: "text/plain",
          sizeBytes: 10,
          role: "bid",
          storagePath: path.join(tempDir, "bid.txt"),
          parseStatus: "已完成",
          pageCount: 1,
          parseMethod: "plain-text",
          textPreview: "投标响应",
          extractedText: "付款响应 技术参数",
          chunks: [{ id: "doc-b-chunk-1", order: 1, text: "付款响应 技术参数" }],
          uploadedAt: new Date().toISOString(),
        },
      ],
    }));

    initializeReviewWorkers();

    const created = await createReviewTask({
      projectId: project.id,
      scenario: "bid_consistency",
      documentIds: ["doc-t", "doc-b"],
    });

    await vi.advanceTimersByTimeAsync(1000);

    expect(store.get().reviewTasks[0]?.status).toBe("进行中");

    deleteReviewTask(created.task.id);

    expect(store.get().reviewTasks).toHaveLength(0);
    expect(store.get().findings).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(5000);

    expect(store.get().reviewTasks).toHaveLength(0);
    expect(store.get().findings).toHaveLength(0);
  });
});
