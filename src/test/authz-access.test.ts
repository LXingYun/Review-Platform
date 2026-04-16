import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("project-scoped authz", () => {
  const originalCwd = process.cwd();
  let tempDir = "";

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "authz-access-test-"));
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
      // Ignore transient sqlite file handle cleanup on Windows.
    }
  });

  it("limits projects, documents, tasks, and findings to project owner", async () => {
    const { createProject, listProjects } = await import("../../server/services/project-service");
    const { listDocuments } = await import("../../server/services/document-service");
    const { listTasks, getTask } = await import("../../server/services/review-service");
    const { listFindings } = await import("../../server/services/finding-service");
    const { store } = await import("../../server/store");
    const { reviewTaskStatusText, reviewRiskLevelText } = await import("../../server/services/review-task-messages");
    const { getReviewTaskStageLabel } = await import("../../server/services/review-task-stage-service");

    const userA = { id: "user-a", username: "usera", role: "user" as const };
    const userB = { id: "user-b", username: "userb", role: "user" as const };
    const admin = { id: "admin", username: "admin", role: "admin" as const };

    const projectA = createProject(
      {
        name: "Project A",
        type: "招标审查",
        description: "",
      },
      userA,
    );
    const projectB = createProject(
      {
        name: "Project B",
        type: "招标审查",
        description: "",
      },
      userB,
    );

    const taskAId = "task-a";
    const taskBId = "task-b";

    store.update((current) => ({
      ...current,
      documents: [
        {
          id: "doc-a",
          projectId: projectA.id,
          fileName: "a.txt",
          originalName: "a.txt",
          mimeType: "text/plain",
          sizeBytes: 10,
          role: "tender",
          storagePath: path.join(tempDir, "a.txt"),
          parseStatus: "已完成",
          pageCount: 1,
          parseMethod: "plain-text",
          textPreview: "a",
          extractedText: "a",
          chunks: [{ id: "doc-a-chunk-1", order: 1, text: "a" }],
          uploadedAt: new Date().toISOString(),
        },
        {
          id: "doc-b",
          projectId: projectB.id,
          fileName: "b.txt",
          originalName: "b.txt",
          mimeType: "text/plain",
          sizeBytes: 10,
          role: "tender",
          storagePath: path.join(tempDir, "b.txt"),
          parseStatus: "已完成",
          pageCount: 1,
          parseMethod: "plain-text",
          textPreview: "b",
          extractedText: "b",
          chunks: [{ id: "doc-b-chunk-1", order: 1, text: "b" }],
          uploadedAt: new Date().toISOString(),
        },
      ],
      reviewTasks: [
        {
          id: taskAId,
          projectId: projectA.id,
          scenario: "tender_compliance",
          name: "Task A",
          status: reviewTaskStatusText.queued,
          stage: "queued",
          stageLabel: getReviewTaskStageLabel("queued"),
          progress: 0,
          riskLevel: reviewRiskLevelText.low,
          documentIds: ["doc-a"],
          attemptCount: 1,
          createdAt: "2025-01-01T00:00:00.000Z",
          completedAt: null,
        },
        {
          id: taskBId,
          projectId: projectB.id,
          scenario: "tender_compliance",
          name: "Task B",
          status: reviewTaskStatusText.queued,
          stage: "queued",
          stageLabel: getReviewTaskStageLabel("queued"),
          progress: 0,
          riskLevel: reviewRiskLevelText.low,
          documentIds: ["doc-b"],
          attemptCount: 1,
          createdAt: "2025-01-01T00:00:01.000Z",
          completedAt: null,
        },
      ],
      findings: [
        {
          id: "finding-a",
          projectId: projectA.id,
          taskId: taskAId,
          title: "finding-a",
          category: "其他",
          risk: "低",
          status: "待复核",
          location: "section-a",
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
        {
          id: "finding-b",
          projectId: projectB.id,
          taskId: taskBId,
          title: "finding-b",
          category: "其他",
          risk: "低",
          status: "待复核",
          location: "section-b",
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

    expect(listProjects("", userA).map((item) => item.id)).toEqual([projectA.id]);
    expect(listDocuments(undefined, userA).map((item) => item.id)).toEqual(["doc-a"]);
    expect(listTasks(undefined, userA).map((item) => item.id)).toEqual([taskAId]);
    expect(listFindings(undefined, userA).map((item) => item.id)).toEqual(["finding-a"]);
    expect(() => getTask(taskBId, userA)).toThrowError(/project not found/i);

    expect(listProjects("", admin).map((item) => item.id).sort()).toEqual([projectA.id, projectB.id].sort());
    expect(listTasks(undefined, admin).map((item) => item.id).sort()).toEqual([taskAId, taskBId].sort());
  });
});
