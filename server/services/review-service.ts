import { store } from "../store";
import { AppData, Finding, ReviewScenario, ReviewTask, ReviewTaskStage } from "../types";
import { getAiConfig } from "./ai-config-service";
import { generateAiScenarioFindings } from "./ai-review-service";
import { normalizeGeneratedFindings } from "./finding-normalization-service";
import { generateTenderChapterAiFindings } from "./tender-ai-review-service";
import { getTaskRegulationsForExecution, resolveTaskRegulationContext } from "./review-context-service";
import { createId, nowIso, summarizeRisk } from "../utils";
import { getReviewTaskStageLabel } from "./review-task-stage-service";
import { toDeterministicSeed } from "./review-seed-service";

const workerConcurrency = 1;

interface RunningTaskExecution {
  attemptCount: number;
  controller: AbortController;
}

const runningControllers = new Map<string, RunningTaskExecution>();

let reviewWorkersStarted = false;
let activeWorkers = 0;
let drainScheduled = false;

export const resolveReviewExecutionMode = (params: {
  aiEnabled: boolean;
}) => (params.aiEnabled ? "ai" : "blocked");

const isAbortError = (error: unknown) =>
  error instanceof Error && (error.name === "AbortError" || error.message.includes("aborted"));

const getReviewFailureMessage = (error: unknown) => {
  if (!(error instanceof Error)) {
    return "AI 审查失败";
  }

  return error.message.trim() || "AI 审查失败";
};

const getTaskById = (taskId: string) => store.get().reviewTasks.find((task) => task.id === taskId);

const isTaskCancelled = (taskId: string, attemptCount: number) => {
  const task = getTaskById(taskId);
  return task?.attemptCount === attemptCount && task.status === "未完成" && task.stageLabel === "任务已中止";
};

const isTaskAttemptRunning = (taskId: string, attemptCount: number) => {
  const task = getTaskById(taskId);
  return task?.attemptCount === attemptCount && task.status === "进行中";
};

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

const scheduleQueueDrain = () => {
  if (drainScheduled) return;
  drainScheduled = true;

  queueMicrotask(() => {
    drainScheduled = false;
    void drainQueue();
  });
};

const claimNextQueuedTask = () => {
  let claimedTaskId: string | null = null;

  store.update((current) => {
    const nextTask = current.reviewTasks
      .filter((task) => task.status === "待审核")
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

    if (!nextTask) {
      return current;
    }

    claimedTaskId = nextTask.id;

    return {
      ...current,
      reviewTasks: current.reviewTasks.map((task) =>
        task.id === nextTask.id
          ? applyTaskStage(
              {
                ...task,
                status: "进行中",
              },
              "preparing_context",
              { progress: 20 },
            )
          : task,
      ),
    };
  });

  return claimedTaskId;
};

const markTaskFailed = (taskId: string, attemptCount: number, message: string) => {
  store.update((current) =>
    updateTaskForAttempt(current, taskId, attemptCount, (task) => {
      if (task.status !== "进行中") {
        return null;
      }

      return applyTaskStage(
        {
          ...task,
          status: "失败",
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
};

const updateRunningTask = (
  taskId: string,
  attemptCount: number,
  updater: (task: ReviewTask) => ReviewTask,
) => {
  if (isTaskCancelled(taskId, attemptCount)) {
    return;
  }

  store.update((current) =>
    updateTaskForAttempt(current, taskId, attemptCount, (task) => {
      if (task.status !== "进行中") {
        return null;
      }

      return updater(task);
    }),
  );
};

const finalizeCancelledTask = (taskId: string, attemptCount: number) => {
  store.update((current) =>
    updateTaskForAttempt(current, taskId, attemptCount, (task) => {
      if (task.status !== "未完成" || task.stageLabel !== "任务已中止") {
        return null;
      }

      return applyTaskStage(
        {
          ...task,
          status: "未完成",
          completedAt: null,
        },
        "aborted",
      );
    }),
  );
};

const abortRunningTask = (taskId: string) => {
  const execution = runningControllers.get(taskId);
  execution?.controller.abort();
  runningControllers.delete(taskId);
};

const runReviewTaskInBackground = async (taskId: string) => {
  const startedAt = Date.now();
  const task = getTaskById(taskId);
  if (!task) return;
  const attemptCount = task.attemptCount;

  const data = store.get();
  const project = data.projects.find((item) => item.id === task.projectId);
  const projectReviewSeed = project ? toDeterministicSeed(project.id) : undefined;
  if (!project) {
    markTaskFailed(taskId, attemptCount, "项目不存在");
    return;
  }

  const taskDocuments = data.documents.filter((document) => task.documentIds.includes(document.id));
  if (taskDocuments.length === 0) {
    markTaskFailed(taskId, attemptCount, "审核任务缺少可用文档");
    return;
  }

  const execution: RunningTaskExecution = {
    attemptCount,
    controller: new AbortController(),
  };
  runningControllers.set(taskId, execution);

  try {
    const latest = store.get();
    const aiConfig = getAiConfig();
    const minimumVisibleDuration = aiConfig.reviewMinVisibleDurationMs;
    const reviewExecutionMode = resolveReviewExecutionMode({
      aiEnabled: aiConfig.enabled,
    });

    if (reviewExecutionMode !== "ai") {
      throw new Error("AI review requires OPENAI_API_KEY");
    }

    const taskRegulations = getTaskRegulationsForExecution({
      task,
      availableRegulations: latest.regulations,
    });

    let findings: Finding[] = [];

    if (task.scenario === "tender_compliance") {
      updateRunningTask(taskId, attemptCount, (currentTask) => ({
        ...applyTaskStage(currentTask, "chapter_review", { progress: 45 }),
      }));

      const tenderDocument = taskDocuments.find((document) => document.role === "tender");
      if (!tenderDocument) {
        throw new Error("招标审查缺少招标文件");
      }

      const tenderResult = await generateTenderChapterAiFindings({
        projectId: project.id,
        taskId,
        tenderDocument,
        regulations: taskRegulations,
        chapterConcurrency: {
          initial: aiConfig.chapterReviewConcurrency,
          min: aiConfig.chapterReviewMinConcurrency,
        },
        seed: projectReviewSeed,
        signal: execution.controller.signal,
        onProgress: ({ current, total, chapterTitle, stage }) => {
          updateRunningTask(taskId, attemptCount, (currentTask) => ({
            ...applyTaskStage(
              currentTask,
              stage === "chapter_review" ? "chapter_review" : "cross_section_review",
              {
                stageLabel:
                  stage === "chapter_review"
                    ? `正在审查 ${current}/${total} 个审查单元：${chapterTitle}`
                    : getReviewTaskStageLabel("cross_section_review"),
                progress: stage === "chapter_review" ? 35 + Math.floor((current / total) * 35) : 78,
              },
            ),
          }));
        },
      });

      findings = tenderResult.findings;
    } else {
      updateRunningTask(taskId, attemptCount, (currentTask) => ({
        ...applyTaskStage(currentTask, "ai_review", { progress: 45 }),
      }));

      const tenderDocument = taskDocuments.find((document) => document.role === "tender");
      const bidDocument = taskDocuments.find((document) => document.role === "bid");

      if (!tenderDocument || !bidDocument) {
        throw new Error("投标审查需要同时包含招标文件和投标文件");
      }

      findings = await generateAiScenarioFindings({
        scenario: task.scenario,
        projectId: project.id,
        taskId,
        documents: taskDocuments,
        regulations: taskRegulations,
        seed: projectReviewSeed,
        signal: execution.controller.signal,
      });
    }

    if (!isTaskAttemptRunning(taskId, attemptCount)) {
      return;
    }

    const normalizedFindings = normalizeGeneratedFindings(findings);
    const riskLevel = summarizeRisk(normalizedFindings.map((finding) => finding.risk));
    const elapsed = Date.now() - startedAt;

    if (elapsed < minimumVisibleDuration) {
      updateRunningTask(taskId, attemptCount, (currentTask) => ({
        ...applyTaskStage(currentTask, "consolidating", { progress: 80 }),
      }));

      await new Promise((resolve) => setTimeout(resolve, minimumVisibleDuration - elapsed));
    }

    if (!isTaskAttemptRunning(taskId, attemptCount)) {
      return;
    }

    store.update((current) => {
      const currentTask = current.reviewTasks.find((item) => item.id === taskId);
      if (!currentTask || currentTask.attemptCount !== attemptCount || currentTask.status !== "进行中") {
        return current;
      }

      return {
        ...current,
        reviewTasks: current.reviewTasks.map((item) =>
          item.id === taskId
            ? applyTaskStage(
                {
                  ...item,
                  status: "已完成",
                  riskLevel,
                  completedAt: nowIso(),
                },
                "completed",
                { progress: 100 },
              )
            : item,
        ),
        findings: [...current.findings.filter((item) => item.taskId !== taskId), ...normalizedFindings],
      };
    });
  } catch (error) {
    if (isTaskCancelled(taskId, attemptCount) || isAbortError(error)) {
      finalizeCancelledTask(taskId, attemptCount);
      return;
    }

    store.update((current) =>
      updateTaskForAttempt(current, taskId, attemptCount, (currentTask) => {
        if (currentTask.status !== "进行中") {
          return null;
        }

        return applyTaskStage(
          {
            ...currentTask,
            status: "失败",
            completedAt: null,
          },
          "failed",
          { stageLabel: getReviewFailureMessage(error) },
        );
      }),
    );
  } finally {
    const currentExecution = runningControllers.get(taskId);
    if (
      currentExecution &&
      currentExecution.attemptCount === execution.attemptCount &&
      currentExecution.controller === execution.controller
    ) {
      runningControllers.delete(taskId);
    }
  }
};

const drainQueue = async () => {
  while (activeWorkers < workerConcurrency) {
    const taskId = claimNextQueuedTask();
    if (!taskId) {
      return;
    }

    activeWorkers += 1;

    void runReviewTaskInBackground(taskId).finally(() => {
      activeWorkers -= 1;
      scheduleQueueDrain();
    });
  }
};

const recoverInterruptedTasks = () => {
  store.update((current) => ({
    ...current,
    reviewTasks: current.reviewTasks.map((task) =>
      task.status === "进行中"
        ? applyTaskStage(
            {
              ...task,
              status: "未完成",
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
};

export const initializeReviewWorkers = () => {
  if (reviewWorkersStarted) return;

  reviewWorkersStarted = true;
  recoverInterruptedTasks();
  scheduleQueueDrain();
};

export const listTasks = (projectId?: string) => {
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
      projectName: data.projects.find((project) => project.id === task.projectId)?.name ?? "未知项目",
    }));
};

export const getTask = (taskId: string) => {
  const data = store.get();
  const task = data.reviewTasks.find((item) => item.id === taskId);

  if (!task) {
    throw new Error("审查任务不存在");
  }

  return {
    ...toPublicTask(task),
    projectName: data.projects.find((project) => project.id === task.projectId)?.name ?? "未知项目",
  };
};

export const createReviewTask = async (params: {
  projectId: string;
  scenario: ReviewScenario;
  documentIds: string[];
  regulationIds?: string[];
}) => {
  const aiConfig = getAiConfig();
  if (!aiConfig.enabled) {
    throw new Error("AI review requires OPENAI_API_KEY");
  }

  const data = store.get();
  const project = data.projects.find((item) => item.id === params.projectId);

  if (!project) {
    throw new Error("项目不存在");
  }

  const taskDocuments = data.documents.filter((document) => params.documentIds.includes(document.id));
  if (taskDocuments.length === 0) {
    throw new Error("审核任务缺少可用文档");
  }

  const taskName =
    params.scenario === "tender_compliance" ? `${project.name}招标文件审查` : `${project.name}投标文件审查`;
  const regulationContext = resolveTaskRegulationContext({
    scenario: params.scenario,
    availableRegulations: data.regulations,
    requestedRegulationIds: params.regulationIds,
  });

  const task: ReviewTask = {
    id: createId("task"),
    projectId: project.id,
    scenario: params.scenario,
    name: taskName,
    status: "待审核",
    stage: "queued",
    stageLabel: getReviewTaskStageLabel("queued"),
    progress: 0,
    riskLevel: "低",
    documentIds: params.documentIds,
    ...regulationContext,
    attemptCount: 1,
    createdAt: nowIso(),
    completedAt: null,
  };

  store.update((current) => ({
    ...current,
    reviewTasks: [task, ...current.reviewTasks],
  }));

  scheduleQueueDrain();

  return {
    task: toPublicTask(task),
    findings: [],
    project,
  };
};

export const retryReviewTask = (taskId: string) => {
  let nextTask: ReviewTask | null = null;

  const next = store.update((current) => {
    const task = current.reviewTasks.find((item) => item.id === taskId);

    if (!task) {
      throw new Error("审核任务不存在");
    }

    if (task.status === "待审核" || task.status === "进行中") {
      throw new Error("当前任务正在执行，无法重试");
    }

    nextTask = applyTaskStage(
      {
        ...task,
        status: "待审核",
        riskLevel: "低",
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

  scheduleQueueDrain();

  return {
    task: toPublicTask(nextTask!),
    findings: [],
    project: next.projects.find((project) => project.id === nextTask!.projectId),
  };
};

export const abortReviewTask = (taskId: string) => {
  let abortedTask: ReviewTask | null = null;

  store.update((current) => {
    const task = current.reviewTasks.find((item) => item.id === taskId);

    if (!task) {
      throw new Error("审核任务不存在");
    }

    if (task.status !== "待审核" && task.status !== "进行中") {
      throw new Error("当前任务不支持中止");
    }

    abortedTask = applyTaskStage(
      {
        ...task,
        status: "未完成",
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

  abortRunningTask(taskId);
  scheduleQueueDrain();

  return {
    success: true,
    task: toPublicTask(abortedTask!),
  };
};

export const deleteReviewTask = (taskId: string) => {
  const current = store.get();
  const task = current.reviewTasks.find((item) => item.id === taskId);

  if (!task) {
    throw new Error("审核任务不存在");
  }

  abortRunningTask(taskId);

  store.update((state) => ({
    ...state,
    reviewTasks: state.reviewTasks.filter((item) => item.id !== taskId),
    findings: state.findings.filter((item) => item.taskId !== taskId),
  }));

  return { success: true, taskId, projectId: task.projectId };
};
