import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("resolveReviewExecutionMode", () => {
  const originalCwd = process.cwd();
  const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
  const originalOpenAiBaseUrl = process.env.OPENAI_BASE_URL;
  const originalReviewWorkerConcurrency = process.env.REVIEW_WORKER_CONCURRENCY;
  const originalReviewMinVisibleDuration = process.env.REVIEW_MIN_VISIBLE_DURATION_MS;
  const originalAiRequestTimeout = process.env.AI_REQUEST_TIMEOUT_MS;
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

    if (originalReviewWorkerConcurrency === undefined) {
      delete process.env.REVIEW_WORKER_CONCURRENCY;
    } else {
      process.env.REVIEW_WORKER_CONCURRENCY = originalReviewWorkerConcurrency;
    }

    if (originalReviewMinVisibleDuration === undefined) {
      delete process.env.REVIEW_MIN_VISIBLE_DURATION_MS;
    } else {
      process.env.REVIEW_MIN_VISIBLE_DURATION_MS = originalReviewMinVisibleDuration;
    }

    if (originalAiRequestTimeout === undefined) {
      delete process.env.AI_REQUEST_TIMEOUT_MS;
    } else {
      process.env.AI_REQUEST_TIMEOUT_MS = originalAiRequestTimeout;
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

  it("uses the same strict consistency seed for identical inputs across different projects", async () => {
    process.env.REVIEW_WORKER_CONCURRENCY = "2";
    process.env.REVIEW_MIN_VISIBLE_DURATION_MS = "0";

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
    const { createReviewTask, initializeReviewWorkers } = await import("../../server/services/review-service");

    const projectA = createProject({
      name: "Strict seed project A",
      type: "\u6295\u6807\u5ba1\u67e5",
      description: "",
    });
    const projectB = createProject({
      name: "Strict seed project B",
      type: "\u6295\u6807\u5ba1\u67e5",
      description: "",
    });

    store.update((current) => ({
      ...current,
      documents: [
        {
          id: "doc-a-t",
          projectId: projectA.id,
          fileName: "tender-a.txt",
          originalName: "tender-a.txt",
          mimeType: "text/plain",
          sizeBytes: 10,
          role: "tender",
          storagePath: path.join(tempDir, "tender-a.txt"),
          parseStatus: "\u5df2\u5b8c\u6210",
          pageCount: 1,
          parseMethod: "plain-text",
          textPreview: "payment requirements",
          extractedText: "payment requirements qualification technical",
          chunks: [{ id: "doc-a-t-chunk-1", order: 1, text: "payment requirements qualification technical" }],
          contentHash: "shared-tender-hash",
          uploadedAt: new Date().toISOString(),
        },
        {
          id: "doc-a-b",
          projectId: projectA.id,
          fileName: "bid-a.txt",
          originalName: "bid-a.txt",
          mimeType: "text/plain",
          sizeBytes: 10,
          role: "bid",
          storagePath: path.join(tempDir, "bid-a.txt"),
          parseStatus: "\u5df2\u5b8c\u6210",
          pageCount: 1,
          parseMethod: "plain-text",
          textPreview: "bid response",
          extractedText: "payment response technical parameters",
          chunks: [{ id: "doc-a-b-chunk-1", order: 1, text: "payment response technical parameters" }],
          contentHash: "shared-bid-hash",
          uploadedAt: new Date().toISOString(),
        },
        {
          id: "doc-b-t",
          projectId: projectB.id,
          fileName: "tender-b.txt",
          originalName: "tender-b.txt",
          mimeType: "text/plain",
          sizeBytes: 10,
          role: "tender",
          storagePath: path.join(tempDir, "tender-b.txt"),
          parseStatus: "\u5df2\u5b8c\u6210",
          pageCount: 1,
          parseMethod: "plain-text",
          textPreview: "payment requirements",
          extractedText: "payment requirements qualification technical",
          chunks: [{ id: "doc-b-t-chunk-1", order: 1, text: "payment requirements qualification technical" }],
          contentHash: "shared-tender-hash",
          uploadedAt: new Date().toISOString(),
        },
        {
          id: "doc-b-b",
          projectId: projectB.id,
          fileName: "bid-b.txt",
          originalName: "bid-b.txt",
          mimeType: "text/plain",
          sizeBytes: 10,
          role: "bid",
          storagePath: path.join(tempDir, "bid-b.txt"),
          parseStatus: "\u5df2\u5b8c\u6210",
          pageCount: 1,
          parseMethod: "plain-text",
          textPreview: "bid response",
          extractedText: "payment response technical parameters",
          chunks: [{ id: "doc-b-b-chunk-1", order: 1, text: "payment response technical parameters" }],
          contentHash: "shared-bid-hash",
          uploadedAt: new Date().toISOString(),
        },
      ],
    }));

    initializeReviewWorkers();

    await createReviewTask({
      projectId: projectA.id,
      scenario: "bid_consistency",
      documentIds: ["doc-a-t", "doc-a-b"],
      consistencyMode: "strict",
    });
    await createReviewTask({
      projectId: projectB.id,
      scenario: "bid_consistency",
      documentIds: ["doc-b-t", "doc-b-b"],
      consistencyMode: "strict",
    });

    await vi.advanceTimersByTimeAsync(1000);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const payloads = fetchMock.mock.calls.map((call) => JSON.parse(String((call[1] as RequestInit)?.body)));
    expect(payloads[0].seed).toBe(payloads[1].seed);
  });

  it("defaults to strict consistency mode when REVIEW_DEFAULT_CONSISTENCY_MODE=strict", async () => {
    process.env.REVIEW_DEFAULT_CONSISTENCY_MODE = "strict";
    process.env.REVIEW_WORKER_CONCURRENCY = "1";
    process.env.REVIEW_MIN_VISIBLE_DURATION_MS = "0";

    const fetchMock = vi.fn(async () =>
      new Response(
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
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { store } = await import("../../server/store");
    const { createProject } = await import("../../server/services/project-service");
    const { createReviewTask, initializeReviewWorkers } = await import("../../server/services/review-service");

    const project = createProject({
      name: "Default strict project",
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
    }));

    initializeReviewWorkers();

    const created = await createReviewTask({
      projectId: project.id,
      scenario: "tender_compliance",
      documentIds: ["doc-t"],
    });

    const createdRecord = store.get().reviewTasks.find((task) => task.id === created.task.id);
    expect(createdRecord?.consistencyMode).toBe("strict");
  });

  it("uses explicit consistencyMode even when env default is strict", async () => {
    process.env.REVIEW_DEFAULT_CONSISTENCY_MODE = "strict";
    process.env.REVIEW_WORKER_CONCURRENCY = "1";
    process.env.REVIEW_MIN_VISIBLE_DURATION_MS = "0";

    const fetchMock = vi.fn(async () =>
      new Response(
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
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { store } = await import("../../server/store");
    const { createProject } = await import("../../server/services/project-service");
    const { createReviewTask, initializeReviewWorkers } = await import("../../server/services/review-service");

    const project = createProject({
      name: "Explicit balanced project",
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
    }));

    initializeReviewWorkers();

    const created = await createReviewTask({
      projectId: project.id,
      scenario: "tender_compliance",
      documentIds: ["doc-t"],
      consistencyMode: "balanced",
    });

    const createdRecord = store.get().reviewTasks.find((task) => task.id === created.task.id);
    expect(createdRecord?.consistencyMode).toBe("balanced");
  });

  it("yields once before starting tender review execution", async () => {
    process.env.REVIEW_WORKER_CONCURRENCY = "1";
    process.env.REVIEW_MIN_VISIBLE_DURATION_MS = "0";

    const immediateQueue: Array<() => void> = [];
    vi.stubGlobal(
      "setImmediate",
      ((callback: (...args: never[]) => void, ...args: never[]) => {
        immediateQueue.push(() => callback(...args));
        return 0 as unknown as NodeJS.Immediate;
      }) as typeof setImmediate,
    );

    const fetchMock = vi.fn(async () =>
      new Response(
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
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { createProject } = await import("../../server/services/project-service");
    const { createReviewTask, initializeReviewWorkers } = await import("../../server/services/review-service");
    const { store } = await import("../../server/store");

    const project = createProject({
      name: "Deferred tender project",
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
    }));

    initializeReviewWorkers();

    await createReviewTask({
      projectId: project.id,
      scenario: "tender_compliance",
      documentIds: ["doc-t"],
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(immediateQueue).toHaveLength(1);

    await immediateQueue.shift()?.();
    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(immediateQueue).toHaveLength(1);

    while (immediateQueue.length > 0 && fetchMock.mock.calls.length === 0) {
      immediateQueue.shift()?.();
      await Promise.resolve();
    }

    for (let turn = 0; turn < 5 && fetchMock.mock.calls.length === 0; turn += 1) {
      await Promise.resolve();
    }

    expect(fetchMock).toHaveBeenCalled();
  });

  it("honors REVIEW_WORKER_CONCURRENCY when draining queued tasks", async () => {
    process.env.REVIEW_WORKER_CONCURRENCY = "2";
    process.env.REVIEW_MIN_VISIBLE_DURATION_MS = "0";

    const pendingResponses: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          pendingResponses.push(resolve);
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { store } = await import("../../server/store");
    const { createProject } = await import("../../server/services/project-service");
    const { createReviewTask, initializeReviewWorkers } = await import("../../server/services/review-service");

    const project = createProject({
      name: "Concurrent worker project",
      type: "\u6295\u6807\u5ba1\u67e5",
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

    await createReviewTask({
      projectId: project.id,
      scenario: "bid_consistency",
      documentIds: ["doc-t", "doc-b"],
    });
    await createReviewTask({
      projectId: project.id,
      scenario: "bid_consistency",
      documentIds: ["doc-t", "doc-b"],
    });

    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(2);

    pendingResponses.splice(0).forEach((resolve) =>
      resolve(
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
      ),
    );

    await Promise.resolve();
  });

  it("marks tender tasks as failed when chapter review worker errors", async () => {
    process.env.REVIEW_WORKER_CONCURRENCY = "1";
    process.env.REVIEW_MIN_VISIBLE_DURATION_MS = "0";

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
    const { createReviewTask, initializeReviewWorkers } = await import("../../server/services/review-service");

    const project = createProject({
      name: "Tender failure project",
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
    }));

    initializeReviewWorkers();

    const created = await createReviewTask({
      projectId: project.id,
      scenario: "tender_compliance",
      documentIds: ["doc-t"],
    });

    await vi.advanceTimersByTimeAsync(1000);

    const task = store.get().reviewTasks.find((item) => item.id === created.task.id);
    expect(task).toBeTruthy();
    expect(task?.status).toBe("\u5931\u8d25");
    expect(task?.stage).toBe("failed");
    expect(task?.stageLabel).toContain("AI \u5ba1\u67e5\u5931\u8d25");
  });

  it("keeps aborted status when user aborts a running tender task", async () => {
    process.env.REVIEW_WORKER_CONCURRENCY = "1";
    process.env.REVIEW_MIN_VISIBLE_DURATION_MS = "0";

    const fetchMock = vi.fn(
      ({ signal }: RequestInit = {}) =>
        new Promise<Response>((_resolve, reject) => {
          if (signal?.aborted) {
            reject(new DOMException("aborted", "AbortError"));
            return;
          }

          signal?.addEventListener(
            "abort",
            () => {
              reject(new DOMException("aborted", "AbortError"));
            },
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { store } = await import("../../server/store");
    const { createProject } = await import("../../server/services/project-service");
    const { abortReviewTask, createReviewTask, initializeReviewWorkers } = await import(
      "../../server/services/review-service"
    );

    const project = createProject({
      name: "Abort project",
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
    }));

    initializeReviewWorkers();

    const created = await createReviewTask({
      projectId: project.id,
      scenario: "tender_compliance",
      documentIds: ["doc-t"],
    });

    await vi.advanceTimersByTimeAsync(10);
    abortReviewTask(created.task.id);
    await vi.advanceTimersByTimeAsync(100);

    const task = store.get().reviewTasks.find((item) => item.id === created.task.id);
    expect(task).toBeTruthy();
    expect(task?.status).toBe("\u672a\u5b8c\u6210");
    expect(task?.stage).toBe("aborted");
  });
});
