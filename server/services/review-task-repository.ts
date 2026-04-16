import { store } from "../store";
import type { AppData, Finding, Project, ReviewTask, ReviewTaskStage } from "../types";
import { nowIso } from "../utils";
import { getReviewTaskStageLabel } from "./review-task-stage-service";
import { diffConsistencyHash } from "./review-consistency-service";
import {
  reviewRiskLevelText,
  reviewTaskMessages,
  reviewTaskStatusText,
} from "./review-task-messages";

export interface ReviewTaskExecutionContext {
  task: ReviewTask;
  project?: Project;
  taskDocuments: AppData["documents"];
  availableRegulations: AppData["regulations"];
}

export interface ReviewTaskCreationContext {
  project?: Project;
  taskDocuments: AppData["documents"];
  availableRegulations: AppData["regulations"];
}

const updateTaskForAttempt = (
  current: AppData,
  taskId: string,
  attemptCount: number,
  updater: (task: ReviewTask) => ReviewTask | null,
) => {
  let updated = false;

  const reviewTasks = current.reviewTasks.map((task) => {
    if (task.id !== taskId || task.attemptCount !== attemptCount) {
      return task;
    }

    const nextTask = updater(task);
    if (!nextTask) {
      return task;
    }

    updated = true;
    return nextTask;
  });

  return updated ? { ...current, reviewTasks } : current;
};

const applyTaskStage = (
  task: ReviewTask,
  stage: ReviewTaskStage,
  options: {
    stageLabel?: string;
    progress?: number;
  } = {},
): ReviewTask => ({
  ...task,
  stage,
  stageLabel: options.stageLabel ?? getReviewTaskStageLabel(stage),
  progress: options.progress ?? task.progress,
});

const toPublicTask = (task: ReviewTask): ReviewTask => ({
  id: task.id,
  projectId: task.projectId,
  scenario: task.scenario,
  consistencyMode: task.consistencyMode,
  consistencyFingerprint: task.consistencyFingerprint,
  consistencyRunHash: task.consistencyRunHash,
  consistencyResult: task.consistencyResult,
  consistencyDiffSummary: task.consistencyDiffSummary,
  name: task.name,
  status: task.status,
  stage: task.stage,
  stageLabel: task.stageLabel,
  progress: task.progress,
  riskLevel: task.riskLevel,
  documentIds: task.documentIds,
  attemptCount: task.attemptCount,
  createdAt: task.createdAt,
  completedAt: task.completedAt,
});

/** Repository for review task reads and writes. */
export class ReviewTaskRepository {
  toPublicTask(task: ReviewTask) {
    return toPublicTask(task);
  }

  findTaskRecord(taskId: string) {
    return store.get().reviewTasks.find((task) => task.id === taskId);
  }

  getTaskExecutionContext(taskId: string): ReviewTaskExecutionContext | null {
    const data = store.get();
    const task = data.reviewTasks.find((item) => item.id === taskId);
    if (!task) {
      return null;
    }

    return {
      task,
      project: data.projects.find((item) => item.id === task.projectId),
      taskDocuments: data.documents.filter((document) => task.documentIds.includes(document.id)),
      availableRegulations: data.regulations,
    };
  }

  getTaskCreationContext(params: {
    projectId: string;
    documentIds: string[];
  }): ReviewTaskCreationContext {
    const data = store.get();
    return {
      project: data.projects.find((item) => item.id === params.projectId),
      taskDocuments: data.documents.filter((document) => params.documentIds.includes(document.id)),
      availableRegulations: data.regulations,
    };
  }

  listTasks(projectId?: string) {
    const data = store.get();

    return data.reviewTasks
      .filter((task) => {
        if (!projectId) return true;
        return task.projectId === projectId;
      })
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((task) => ({
        ...toPublicTask(task),
        projectName: data.projects.find((project) => project.id === task.projectId)?.name ?? reviewTaskMessages.unknownProject,
      }));
  }

  getTask(taskId: string) {
    const data = store.get();
    const task = data.reviewTasks.find((item) => item.id === taskId);

    if (!task) {
      throw new Error(reviewTaskMessages.taskNotFound);
    }

    return {
      ...toPublicTask(task),
      projectName: data.projects.find((project) => project.id === task.projectId)?.name ?? reviewTaskMessages.unknownProject,
    };
  }

  countQueuedTasks() {
    return store.get().reviewTasks.filter((task) => task.status === reviewTaskStatusText.queued).length;
  }

  claimNextQueuedTask(queueCursor: number) {
    let claimedTaskId: string | null = null;
    let nextCursor = queueCursor;

    store.update((current) => {
      const queuedTasks = current.reviewTasks
        .filter((task) => task.status === reviewTaskStatusText.queued)
        .slice()
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      if (queuedTasks.length === 0) {
        return current;
      }

      const nextTask = queuedTasks[queueCursor % queuedTasks.length];
      nextCursor = (queueCursor + 1) % queuedTasks.length;
      claimedTaskId = nextTask.id;

      return {
        ...current,
        reviewTasks: current.reviewTasks.map((task) =>
          task.id === nextTask.id
            ? applyTaskStage(
                {
                  ...task,
                  status: reviewTaskStatusText.running,
                },
                "preparing_context",
                { progress: 20 },
              )
            : task,
        ),
      };
    });

    return {
      taskId: claimedTaskId,
      nextCursor,
    };
  }

  createTaskRecord(task: ReviewTask) {
    store.update((current) => ({
      ...current,
      reviewTasks: [task, ...current.reviewTasks],
    }));

    return task;
  }

  recoverInterruptedTasks() {
    store.update((current) => ({
      ...current,
      reviewTasks: current.reviewTasks.map((task) =>
        task.status === reviewTaskStatusText.running
          ? applyTaskStage(
              {
                ...task,
                status: reviewTaskStatusText.unfinished,
                completedAt: null,
              },
              "interrupted",
              {
                progress: Math.min(task.progress, 99),
              },
            )
          : task,
      ),
    }));
  }

  updateRunningTask(
    taskId: string,
    attemptCount: number,
    updater: (task: ReviewTask) => ReviewTask,
  ) {
    store.update((current) =>
      updateTaskForAttempt(current, taskId, attemptCount, (task) => {
        if (task.status !== reviewTaskStatusText.running) {
          return null;
        }

        return updater(task);
      }),
    );
  }

  markTaskFailed(taskId: string, attemptCount: number, message: string) {
    store.update((current) =>
      updateTaskForAttempt(current, taskId, attemptCount, (task) => {
        if (task.status !== reviewTaskStatusText.running) {
          return null;
        }

        return applyTaskStage(
          {
            ...task,
            status: reviewTaskStatusText.failed,
            completedAt: null,
          },
          "failed",
          {
            stageLabel: message,
            progress: 0,
          },
        );
      }),
    );
  }

  finalizeCancelledTask(taskId: string, attemptCount: number) {
    store.update((current) =>
      updateTaskForAttempt(current, taskId, attemptCount, (task) => {
        if (task.status !== reviewTaskStatusText.unfinished || task.stage !== "aborted") {
          return null;
        }

        return applyTaskStage(
          {
            ...task,
            status: reviewTaskStatusText.unfinished,
            completedAt: null,
          },
          "aborted",
        );
      }),
    );
  }

  completeTask(params: {
    taskId: string;
    attemptCount: number;
    riskLevel: ReviewTask["riskLevel"];
    findings: Finding[];
    consistencyRunHash?: string;
  }) {
    store.update((current) => {
      const currentTask = current.reviewTasks.find((item) => item.id === params.taskId);
      if (
        !currentTask ||
        currentTask.attemptCount !== params.attemptCount ||
        currentTask.status !== reviewTaskStatusText.running
      ) {
        return current;
      }

      const previousTask = currentTask.consistencyFingerprint
        ? current.reviewTasks
            .filter(
              (item) =>
                item.id !== params.taskId &&
                item.status === reviewTaskStatusText.completed &&
                item.consistencyFingerprint === currentTask.consistencyFingerprint &&
                item.consistencyRunHash,
            )
            .slice()
            .sort((left, right) => (right.completedAt ?? "").localeCompare(left.completedAt ?? ""))[0]
        : undefined;
      const previousFindings = previousTask
        ? current.findings.filter((item) => item.taskId === previousTask.id)
        : [];
      const consistencyResult = currentTask.consistencyFingerprint
        ? previousTask
          ? previousTask.consistencyRunHash === params.consistencyRunHash
            ? "consistent"
            : "drifted"
          : "first-run"
        : undefined;
      const consistencyDiffSummary =
        consistencyResult === "drifted" ? diffConsistencyHash(previousFindings, params.findings) : undefined;

      return {
        ...current,
        reviewTasks: current.reviewTasks.map((item) =>
          item.id === params.taskId
            ? applyTaskStage(
                {
                  ...item,
                  status: reviewTaskStatusText.completed,
                  riskLevel: params.riskLevel,
                  consistencyRunHash: params.consistencyRunHash,
                  consistencyResult,
                  consistencyDiffSummary,
                  completedAt: nowIso(),
                },
                "completed",
                { progress: 100 },
              )
            : item,
        ),
        findings: [...current.findings.filter((item) => item.taskId !== params.taskId), ...params.findings],
      };
    });
  }

  retryTask(taskId: string) {
    let nextTask: ReviewTask | null = null;

    const next = store.update((current) => {
      const task = current.reviewTasks.find((item) => item.id === taskId);

      if (!task) {
        throw new Error(reviewTaskMessages.taskNotFound);
      }

      if (task.status === reviewTaskStatusText.queued || task.status === reviewTaskStatusText.running) {
        throw new Error(reviewTaskMessages.taskStillRunning);
      }

      nextTask = applyTaskStage(
        {
          ...task,
          status: reviewTaskStatusText.queued,
          riskLevel: reviewRiskLevelText.low,
          attemptCount: task.attemptCount + 1,
          completedAt: null,
        },
        "queued",
        { progress: 0 },
      );

      return {
        ...current,
        reviewTasks: current.reviewTasks.map((item) => (item.id === taskId ? nextTask! : item)),
        findings: current.findings.filter((finding) => finding.taskId !== taskId),
      };
    });

    return {
      task: toPublicTask(nextTask!),
      findings: [],
      project: next.projects.find((project) => project.id === nextTask!.projectId),
    };
  }

  abortTask(taskId: string) {
    let abortedTask: ReviewTask | null = null;

    store.update((current) => {
      const task = current.reviewTasks.find((item) => item.id === taskId);

      if (!task) {
        throw new Error(reviewTaskMessages.taskNotFound);
      }

      if (task.status !== reviewTaskStatusText.queued && task.status !== reviewTaskStatusText.running) {
        throw new Error(reviewTaskMessages.taskCannotAbort);
      }

      abortedTask = applyTaskStage(
        {
          ...task,
          status: reviewTaskStatusText.unfinished,
          completedAt: null,
        },
        "aborted",
      );

      return {
        ...current,
        reviewTasks: current.reviewTasks.map((item) => (item.id === taskId ? abortedTask! : item)),
        findings: current.findings.filter((finding) => finding.taskId !== taskId),
      };
    });

    return {
      success: true,
      task: toPublicTask(abortedTask!),
    };
  }

  deleteTask(taskId: string) {
    const current = store.get();
    const task = current.reviewTasks.find((item) => item.id === taskId);

    if (!task) {
      throw new Error(reviewTaskMessages.taskNotFound);
    }

    store.update((state) => ({
      ...state,
      reviewTasks: state.reviewTasks.filter((item) => item.id !== taskId),
      findings: state.findings.filter((item) => item.taskId !== taskId),
    }));

    return { success: true, taskId, projectId: task.projectId };
  }
}

let sharedReviewTaskRepository: ReviewTaskRepository | null = null;

export const getSharedReviewTaskRepository = () => {
  if (!sharedReviewTaskRepository) {
    sharedReviewTaskRepository = new ReviewTaskRepository();
  }

  return sharedReviewTaskRepository;
};
