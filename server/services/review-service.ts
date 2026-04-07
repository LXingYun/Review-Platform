import { store } from "../store";
import { Finding, ReviewScenario, ReviewTask } from "../types";
import { getAiConfig } from "./ai-config-service";
import { generateAiScenarioFindings } from "./ai-review-service";
import { generateTenderChapterAiFindings } from "./tender-ai-review-service";
import { createId, nowIso, summarizeRisk } from "../utils";

export const resolveReviewExecutionMode = (params: {
  aiEnabled: boolean;
}) => (params.aiEnabled ? "ai" : "blocked");

const getReviewFailureMessage = (error: unknown) => {
  if (!(error instanceof Error)) {
    return "AI 审查失败";
  }

  return error.message.trim() || "AI 审查失败";
};

const runReviewTaskInBackground = async (taskId: string) => {
  const startedAt = Date.now();
  const data = store.get();
  const task = data.reviewTasks.find((item) => item.id === taskId);
  if (!task) return;

  const project = data.projects.find((item) => item.id === task.projectId);
  if (!project) return;

  const taskDocuments = data.documents.filter((document) => task.documentIds.includes(document.id));
  if (taskDocuments.length === 0) return;

  store.update((current) => ({
    ...current,
    reviewTasks: current.reviewTasks.map((item) =>
      item.id === taskId ? { ...item, status: "进行中", stageLabel: "准备审查上下文", progress: 20 } : item,
    ),
    projects: current.projects.map((item) =>
      item.id === project.id ? { ...item, status: "进行中" } : item,
    ),
  }));

  await new Promise((resolve) => setTimeout(resolve, 1500));

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
      store.update((current) => ({
        ...current,
        reviewTasks: current.reviewTasks.map((item) =>
          item.id === taskId ? { ...item, stageLabel: "进行章节级合规审查", progress: 45 } : item,
        ),
      }));

      const tenderResult = await generateTenderChapterAiFindings({
        projectId: project.id,
        taskId,
        tenderDocument: taskDocuments.find((document) => document.role === "tender") ?? taskDocuments[0],
        regulations: latest.regulations,
        onProgress: ({ current, total, chapterTitle, stage }) => {
          store.update((currentState) => ({
            ...currentState,
            reviewTasks: currentState.reviewTasks.map((item) =>
              item.id === taskId
                ? {
                    ...item,
                    stageLabel:
                      stage === "chapter_review"
                        ? `正在审查第 ${current}/${total} 章：${chapterTitle}`
                        : "正在进行跨章节一致性检查",
                    progress: stage === "chapter_review" ? 35 + Math.floor((current / total) * 35) : 78,
                  }
                : item,
            ),
          }));
        },
      });

      findings = tenderResult.findings;
    } else {
      findings = await generateAiScenarioFindings({
        scenario: task.scenario,
        projectId: project.id,
        taskId,
        documents: taskDocuments,
        regulations: latest.regulations,
      });
    }

    const riskLevel = summarizeRisk(findings.map((finding) => finding.risk));

    const elapsed = Date.now() - startedAt;
    const minimumVisibleDuration = 4500;
    if (elapsed < minimumVisibleDuration) {
      store.update((current) => ({
        ...current,
        reviewTasks: current.reviewTasks.map((item) =>
          item.id === taskId ? { ...item, status: "进行中", stageLabel: "整合审查结果", progress: 80 } : item,
        ),
      }));

      await new Promise((resolve) => setTimeout(resolve, minimumVisibleDuration - elapsed));
    }

    store.update((current) => ({
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
      projects: current.projects.map((item) =>
        item.id === project.id ? { ...item, status: "进行中" } : item,
      ),
    }));
  } catch (error) {
    store.update((current) => ({
      ...current,
      reviewTasks: current.reviewTasks.map((item) =>
        item.id === taskId
          ? {
              ...item,
              status: "失败",
              stageLabel: getReviewFailureMessage(error),
            }
          : item,
      ),
    }));
  }
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
    throw new Error("审查任务缺少可用文档");
  }

  const taskName =
    params.scenario === "tender_compliance"
      ? `${project.name}招标文件审查`
      : `${project.name}投标文件审查`;

  const task: ReviewTask = {
    id: createId("task"),
    projectId: project.id,
    scenario: params.scenario,
    name: taskName,
    status: "待审查",
    stageLabel: "等待后台处理",
    progress: 0,
    riskLevel: "低",
    documentIds: params.documentIds,
    createdAt: nowIso(),
    completedAt: null,
  };

  const next = store.update((current) => ({
    ...current,
    projects: current.projects.map((item) =>
      item.id === project.id ? { ...item, status: "进行中" } : item,
    ),
    reviewTasks: [task, ...current.reviewTasks],
  }));

  // Fire-and-forget background processing keeps the UI responsive while still
  // preserving a realistic task lifecycle for review execution.
  setTimeout(() => {
    void runReviewTaskInBackground(task.id);
  }, 500);

  return {
    task,
    findings: [],
    project: next.projects.find((item) => item.id === project.id),
  };
};

export const deleteReviewTask = (taskId: string) => {
  const current = store.get();
  const task = current.reviewTasks.find((item) => item.id === taskId);

  if (!task) {
    throw new Error("审查任务不存在");
  }

  store.update((state) => ({
    ...state,
    reviewTasks: state.reviewTasks.filter((item) => item.id !== taskId),
    findings: state.findings.filter((item) => item.taskId !== taskId),
  }));

  return { success: true, taskId, projectId: task.projectId };
};
