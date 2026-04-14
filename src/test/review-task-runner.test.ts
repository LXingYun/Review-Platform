import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("ReviewTaskRunner", () => {
  const originalCwd = process.cwd();
  const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
  const originalOpenAiBaseUrl = process.env.OPENAI_BASE_URL;
  let tempDir = "";

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-task-runner-test-"));
    process.chdir(tempDir);
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_BASE_URL = "https://example.test";
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.chdir(originalCwd);

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore transient sqlite file handle issues on Windows.
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

  it("prefixes upstream AI failures with Chinese review failure text", async () => {
    const fetchMock = vi.fn(async () =>
      new Response("unauthorized", {
        status: 401,
        headers: {
          "Content-Type": "text/plain",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { store } = await import("../../server/store");
    const { createProject } = await import("../../server/services/project-service");
    const { ReviewTaskRunner } = await import("../../server/services/review-task-runner");
    const { ReviewTaskRepository } = await import("../../server/services/review-task-repository");
    const { reviewTaskStatusText, reviewRiskLevelText } = await import("../../server/services/review-task-messages");
    const { getReviewTaskStageLabel } = await import("../../server/services/review-task-stage-service");

    const project = createProject({
      name: "Runner failure project",
      type: "\u62db\u6807\u5ba1\u67e5",
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
          parseStatus: "\u5df2\u5b8c\u6210",
          pageCount: 1,
          parseMethod: "plain-text",
          textPreview: "chapter one",
          extractedText: "chapter one content",
          chunks: [{ id: "doc-t-chunk-1", order: 1, text: "chapter one content" }],
          uploadedAt: new Date().toISOString(),
        },
      ],
      reviewTasks: [
        {
          id: "task-runner",
          projectId: project.id,
          scenario: "tender_compliance",
          name: "runner task",
          status: reviewTaskStatusText.running,
          stage: "preparing_context",
          stageLabel: getReviewTaskStageLabel("preparing_context"),
          progress: 20,
          riskLevel: reviewRiskLevelText.low,
          documentIds: ["doc-t"],
          attemptCount: 1,
          createdAt: new Date().toISOString(),
          completedAt: null,
        },
      ],
    }));

    const repository = new ReviewTaskRepository();
    const runner = new ReviewTaskRunner(repository);

    await runner.runReviewTask("task-runner");

    const task = repository.findTaskRecord("task-runner");
    expect(task?.status).toBe(reviewTaskStatusText.failed);
    expect(task?.stageLabel).toContain("AI \u5ba1\u67e5\u5931\u8d25");
  });
});
