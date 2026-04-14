import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("ReviewTaskRepository", () => {
  const originalCwd = process.cwd();
  let tempDir = "";

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-task-repository-test-"));
    process.chdir(tempDir);
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
  });

  it("claims queued tasks using the provided cursor and moves the task to preparing_context", async () => {
    const { store } = await import("../../server/store");
    const { ReviewTaskRepository } = await import("../../server/services/review-task-repository");
    const { reviewTaskStatusText, reviewRiskLevelText } = await import("../../server/services/review-task-messages");
    const { createProject } = await import("../../server/services/project-service");
    const { getReviewTaskStageLabel } = await import("../../server/services/review-task-stage-service");

    const project = createProject({
      name: "Repository queue project",
      type: "\u62db\u6807\u5ba1\u67e5",
      description: "",
    });
    const repository = new ReviewTaskRepository();

    store.update((current) => ({
      ...current,
      documents: [
        {
          id: "doc-1",
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
          textPreview: "doc",
          extractedText: "doc",
          chunks: [{ id: "doc-1-chunk-1", order: 1, text: "doc" }],
          uploadedAt: new Date().toISOString(),
        },
      ],
      reviewTasks: [
        {
          id: "task-1",
          projectId: project.id,
          scenario: "tender_compliance",
          name: "task-1",
          status: reviewTaskStatusText.queued,
          stage: "queued",
          stageLabel: getReviewTaskStageLabel("queued"),
          progress: 0,
          riskLevel: reviewRiskLevelText.low,
          documentIds: ["doc-1"],
          attemptCount: 1,
          createdAt: "2025-01-01T00:00:00.000Z",
          completedAt: null,
        },
        {
          id: "task-2",
          projectId: project.id,
          scenario: "tender_compliance",
          name: "task-2",
          status: reviewTaskStatusText.queued,
          stage: "queued",
          stageLabel: getReviewTaskStageLabel("queued"),
          progress: 0,
          riskLevel: reviewRiskLevelText.low,
          documentIds: ["doc-1"],
          attemptCount: 1,
          createdAt: "2025-01-01T00:00:01.000Z",
          completedAt: null,
        },
      ],
    }));

    const claimed = repository.claimNextQueuedTask(1);

    expect(claimed.taskId).toBe("task-2");
    expect(claimed.nextCursor).toBe(0);

    const task = repository.findTaskRecord("task-2");
    expect(task?.status).toBe(reviewTaskStatusText.running);
    expect(task?.stage).toBe("preparing_context");
    expect(task?.progress).toBe(20);
  });

  it("retries a finished task by incrementing attempt count and clearing findings", async () => {
    const { store } = await import("../../server/store");
    const { ReviewTaskRepository } = await import("../../server/services/review-task-repository");
    const { reviewTaskStatusText, reviewRiskLevelText } = await import("../../server/services/review-task-messages");
    const { createProject } = await import("../../server/services/project-service");
    const { getReviewTaskStageLabel } = await import("../../server/services/review-task-stage-service");

    const project = createProject({
      name: "Retry repo project",
      type: "\u62db\u6807\u5ba1\u67e5",
      description: "",
    });

    const repository = new ReviewTaskRepository();

    store.update((current) => ({
      ...current,
      documents: [
        {
          id: "doc-1",
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
          textPreview: "doc",
          extractedText: "doc",
          chunks: [{ id: "doc-1-chunk-1", order: 1, text: "doc" }],
          uploadedAt: new Date().toISOString(),
        },
      ],
      reviewTasks: [
        {
          id: "task-retry",
          projectId: project.id,
          scenario: "tender_compliance",
          name: "retry-task",
          status: reviewTaskStatusText.failed,
          stage: "failed",
          stageLabel: getReviewTaskStageLabel("failed"),
          progress: 0,
          riskLevel: reviewRiskLevelText.low,
          documentIds: ["doc-1"],
          attemptCount: 1,
          createdAt: "2025-01-01T00:00:00.000Z",
          completedAt: null,
        },
      ],
      findings: [
        {
          id: "finding-1",
          projectId: project.id,
          taskId: "task-retry",
          title: "finding",
          category: "\u5176\u4ed6",
          risk: "\u4f4e",
          status: "\u5f85\u590d\u6838",
          location: "loc",
          description: "desc",
          recommendation: "rec",
          references: [],
          sourceChunkIds: [],
          candidateChunkIds: [],
          regulationChunkIds: [],
          needsHumanReview: true,
          confidence: 0.5,
          reviewStage: "chapter_review",
          scenario: "tender_compliance",
          reviewLogs: [],
          createdAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    }));

    const result = repository.retryTask("task-retry");

    expect(result.task.attemptCount).toBe(2);
    expect(result.task.status).toBe(reviewTaskStatusText.queued);
    expect(store.get().findings).toHaveLength(0);
  });
});
