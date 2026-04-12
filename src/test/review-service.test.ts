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

  it("uses deterministic project seed and does not restore findings after deleting a running task", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  findings: [],
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
    );
    vi.stubGlobal("fetch", fetchMock);

    const { store } = await import("../../server/store");
    const { createProject } = await import("../../server/services/project-service");
    const { createReviewTask, deleteReviewTask, initializeReviewWorkers } = await import(
      "../../server/services/review-service"
    );
    const { toDeterministicSeed } = await import("../../server/services/review-seed-service");

    const project = createProject({
      name: "Seed test project",
      type: "\u6295\u6807\u5ba1\u67e5",
      description: "",
    });
    const expectedSeed = toDeterministicSeed(project.id);

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
          textPreview: "payment requirements",
          extractedText: "payment requirements qualification technical",
          chunks: [{ id: "doc-t-chunk-1", order: 1, text: "payment requirements qualification technical" }],
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
          parseStatus: "\u5df2\u5b8c\u6210",
          pageCount: 1,
          parseMethod: "plain-text",
          textPreview: "bid response",
          extractedText: "payment response technical parameters",
          chunks: [{ id: "doc-b-chunk-1", order: 1, text: "payment response technical parameters" }],
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
    expect(fetchMock).toHaveBeenCalled();

    const firstRequest = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(typeof firstRequest?.body).toBe("string");

    if (typeof firstRequest?.body === "string") {
      const payload = JSON.parse(firstRequest.body) as { seed?: number };
      expect(payload.seed).toBe(expectedSeed);
    }

    expect(store.get().reviewTasks).toHaveLength(1);

    deleteReviewTask(created.task.id);

    expect(store.get().reviewTasks).toHaveLength(0);
    expect(store.get().findings).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(5000);

    expect(store.get().reviewTasks).toHaveLength(0);
    expect(store.get().findings).toHaveLength(0);
  });
});
