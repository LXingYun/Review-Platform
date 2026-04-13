import type { ReviewScenario, ReviewTaskDetailItem } from "@/lib/api-types";

export const TASK_CREATION_RECOVERY_MAX_ATTEMPTS = 8;
export const TASK_CREATION_RECOVERY_INTERVAL_MS = 1000;
export const TASK_CREATION_LOOKBACK_WINDOW_MS = 5000;

export const waitFor = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs));

export const findRecoveredTask = (params: {
  tasks: ReviewTaskDetailItem[];
  projectId: string;
  scenario: ReviewScenario;
  requestStartedAtMs: number;
}) => {
  const lowerBound = params.requestStartedAtMs - TASK_CREATION_LOOKBACK_WINDOW_MS;

  return params.tasks
    .filter((task) => {
      if (task.projectId !== params.projectId || task.scenario !== params.scenario) {
        return false;
      }

      const createdAtMs = Date.parse(task.createdAt);
      return Number.isFinite(createdAtMs) && createdAtMs >= lowerBound;
    })
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
};
