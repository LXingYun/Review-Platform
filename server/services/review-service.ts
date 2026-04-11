import { store } from "../store";
import { AppData, Finding, ReviewScenario, ReviewTask } from "../types";
import { getAiConfig } from "./ai-config-service";
import { generateAiScenarioFindings } from "./ai-review-service";
import { generateTenderChapterAiFindings } from "./tender-ai-review-service";
import { createId, nowIso, summarizeRisk } from "../utils";

const minimumVisibleDuration = 4500;
const workerConcurrency = Math.max(1, Number(process.env.REVIEW_WORKER_CONCURRENCY ?? 2));

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
          ? {
              ...task,
              status: "进行中",
              stageLabel: "准备审核上下文",
              progress: 20,
            }
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

      return {
        ...task,
        status: "失败",
        stageLabel: message,
        progress: 0,
        completedAt: null,
      };
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

      return {
        ...task,
        status: "未完成",
        stageLabel: "任务已中止",
        completedAt: null,
      };
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
    const reviewExecutionMode = resolveReviewExecutionMode({
      aiEnabled: aiConfig.enabled,
    });

    if (reviewExecutionMode !== "ai") {
      throw new Error("AI review requires OPENAI_API_KEY");
    }

    let findings: Finding[] = [];

    if (task.scenario === "tender_compliance") {
      updateRunningTask(taskId, attemptCount, (currentTask) => ({
        ...currentTask,
        stageLabel: "进行章节级合规审查",
        progress: 45,
      }));

      const tenderDocument = taskDocuments.find((document) => document.role === "tender");
      if (!tenderDocument) {
        throw new Error("招标审查缺少招标文件");
      }

      const tenderResult = await generateTenderChapterAiFindings({
        projectId: project.id,
        taskId,
        tenderDocument,
        regulations: latest.regulations,
        signal: execution.controller.signal,
        onProgress: ({ current, total, chapterTitle, stage }) => {
          updateRunningTask(taskId, attemptCount, (currentTask) => ({
            ...currentTask,
            stageLabel:
              stage === "chapter_review"
                ? `正在审查 ${current}/${total} 个审查单元：${chapterTitle}`
                : "正在进行跨章节一致性检查",
            progress: stage === "chapter_review" ? 35 + Math.floor((current / total) * 35) : 78,
          }));
        },
      });

      findings = tenderResult.findings;
    } else {
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
        regulations: latest.regulations,
        signal: execution.controller.signal,
      });
    }

    if (!isTaskAttemptRunning(taskId, attemptCount)) {
      return;
    }

    const riskLevel = summarizeRisk(findings.map((finding) => finding.risk));
    const elapsed = Date.now() - startedAt;

    if (elapsed < minimumVisibleDuration) {
      updateRunningTask(taskId, attemptCount, (currentTask) => ({
        ...currentTask,
        stageLabel: "整合审查结果",
        progress: 80,
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
            ? {
                ...item,
                status: "已完成",
                stageLabel: "审查完成",
                progress: 100,
                riskLevel,
                completedAt: nowIso(),
              }
            : item,
        ),
        findings: [...current.findings.filter((item) => item.taskId !== taskId), ...findings],
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

        return {
          ...currentTask,
          status: "失败",
          stageLabel: getReviewFailureMessage(error),
          completedAt: null,
        };
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
        ? {
            ...task,
            status: "未完成",
            stageLabel: "服务中断，任务未完成",
            progress: Math.min(task.progress, 99),
            completedAt: null,
          }
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
      ...task,
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
    ...task,
    projectName: data.projects.find((project) => project.id === task.projectId)?.name ?? "未知项目",
  };
};

export const createReviewTask = async (params: {
  projectId: string;
  scenario: ReviewScenario;
  documentIds: string[];
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

  const task: ReviewTask = {
    id: createId("task"),
    projectId: project.id,
    scenario: params.scenario,
    name: taskName,
    status: "待审核",
    stageLabel: "等待后台处理",
    progress: 0,
    riskLevel: "低",
    documentIds: params.documentIds,
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
    task,
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

    nextTask = {
      ...task,
      status: "待审核",
      stageLabel: "等待后台处理",
      progress: 0,
      riskLevel: "低",
      attemptCount: task.attemptCount + 1,
      completedAt: null,
    };

    return {
      ...current,
      reviewTasks: current.reviewTasks.map((item) => (item.id === taskId ? nextTask! : item)),
      findings: current.findings.filter((finding) => finding.taskId !== taskId),
    };
  });

  scheduleQueueDrain();

  return {
    task: nextTask!,
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

    abortedTask = {
      ...task,
      status: "未完成",
      stageLabel: "任务已中止",
      completedAt: null,
    };

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
    task: abortedTask!,
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
