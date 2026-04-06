import { store } from "../store";
import { ReviewScenario, ReviewTask } from "../types";
import { getAiConfig } from "./ai-config-service";
import { generateAiScenarioFindings } from "./ai-review-service";
import { createId, generateScenarioFindings, nowIso, summarizeRisk } from "../utils";

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
      item.id === taskId ? { ...item, status: "进行中", progress: 35 } : item,
    ),
    projects: current.projects.map((item) =>
      item.id === project.id ? { ...item, status: "进行中" } : item,
    ),
  }));

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const latest = store.get();
  const aiConfig = getAiConfig();
  const canRunAiForScenario =
    aiConfig.enabled &&
    (task.scenario !== "tender_compliance" || latest.regulations.length > 0);

  const findings = canRunAiForScenario
    ? await generateAiScenarioFindings({
        scenario: task.scenario,
        projectId: project.id,
        taskId,
        documents: taskDocuments,
        regulations: latest.regulations,
      }).catch(() =>
        generateScenarioFindings(
          task.scenario,
          project.id,
          taskId,
          taskDocuments,
          latest.regulations,
        ),
      )
    : generateScenarioFindings(
        task.scenario,
        project.id,
        taskId,
        taskDocuments,
        latest.regulations,
      );

  const riskLevel = summarizeRisk(findings.map((finding) => finding.risk));

  const elapsed = Date.now() - startedAt;
  const minimumVisibleDuration = 4500;
  if (elapsed < minimumVisibleDuration) {
    store.update((current) => ({
      ...current,
      reviewTasks: current.reviewTasks.map((item) =>
        item.id === taskId ? { ...item, status: "进行中", progress: 80 } : item,
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
