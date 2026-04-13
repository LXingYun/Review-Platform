import { describe, expect, it } from "vitest";
import type { ReviewTaskDetailItem } from "@/lib/api-types";
import { findRecoveredTask } from "@/components/features/upload/taskCreationRecovery";

const createTask = (params: {
  id: string;
  projectId: string;
  scenario: ReviewTaskDetailItem["scenario"];
  createdAt: string;
}): ReviewTaskDetailItem =>
  ({
    id: params.id,
    projectId: params.projectId,
    scenario: params.scenario,
    name: params.id,
    status: "待审核",
    stage: "queued",
    stageLabel: "queued",
    progress: 0,
    riskLevel: "低",
    documentIds: [],
    attemptCount: 1,
    createdAt: params.createdAt,
    completedAt: null,
    projectName: "test-project",
  }) as ReviewTaskDetailItem;

describe("findRecoveredTask", () => {
  it("returns the latest matching task within the lookback window", () => {
    const requestStartedAtMs = Date.now();
    const tasks: ReviewTaskDetailItem[] = [
      createTask({
        id: "old",
        projectId: "project-1",
        scenario: "tender_compliance",
        createdAt: new Date(requestStartedAtMs - 20_000).toISOString(),
      }),
      createTask({
        id: "match-1",
        projectId: "project-1",
        scenario: "tender_compliance",
        createdAt: new Date(requestStartedAtMs - 1_000).toISOString(),
      }),
      createTask({
        id: "match-2",
        projectId: "project-1",
        scenario: "tender_compliance",
        createdAt: new Date(requestStartedAtMs + 1_000).toISOString(),
      }),
    ];

    const recovered = findRecoveredTask({
      tasks,
      projectId: "project-1",
      scenario: "tender_compliance",
      requestStartedAtMs,
    });

    expect(recovered?.id).toBe("match-2");
  });

  it("returns undefined when no task matches project/scenario/time", () => {
    const requestStartedAtMs = Date.now();
    const tasks: ReviewTaskDetailItem[] = [
      createTask({
        id: "other-project",
        projectId: "project-2",
        scenario: "tender_compliance",
        createdAt: new Date(requestStartedAtMs).toISOString(),
      }),
      createTask({
        id: "other-scenario",
        projectId: "project-1",
        scenario: "bid_consistency",
        createdAt: new Date(requestStartedAtMs).toISOString(),
      }),
      createTask({
        id: "too-old",
        projectId: "project-1",
        scenario: "tender_compliance",
        createdAt: new Date(requestStartedAtMs - 10_000).toISOString(),
      }),
    ];

    const recovered = findRecoveredTask({
      tasks,
      projectId: "project-1",
      scenario: "tender_compliance",
      requestStartedAtMs,
    });

    expect(recovered).toBeUndefined();
  });
});
