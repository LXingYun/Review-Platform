import fs from "node:fs";
import { store } from "../store";
import { Project, ProjectStatus, ReviewTaskStatus } from "../types";
import { createId, nowIso } from "../utils";

const activeTaskStatuses = new Set<ReviewTaskStatus>(["待审核", "进行中"]);
const unfinishedTaskStatuses = new Set<ReviewTaskStatus>(["失败", "未完成"]);

const deriveProjectStatus = (projectId: string, reviewTasks: Array<{ projectId: string; status: ReviewTaskStatus }>): ProjectStatus => {
  const projectTasks = reviewTasks.filter((task) => task.projectId === projectId);

  if (projectTasks.length === 0) {
    return "待开始";
  }

  if (projectTasks.some((task) => activeTaskStatuses.has(task.status))) {
    return "进行中";
  }

  if (projectTasks.some((task) => unfinishedTaskStatuses.has(task.status))) {
    return "未完成";
  }

  return "已完成";
};

export const listProjects = (search?: string) => {
  const data = store.get();
  const keyword = search?.trim();

  return data.projects
    .filter((project) => {
      if (!keyword) return true;
      return project.name.includes(keyword) || project.type.includes(keyword);
    })
    .map((project) => {
      const taskCount = data.reviewTasks.filter((task) => task.projectId === project.id).length;
      const issueCount = data.findings.filter((finding) => finding.projectId === project.id).length;

      return {
        ...project,
        status: deriveProjectStatus(project.id, data.reviewTasks),
        taskCount,
        issueCount,
        date: project.createdAt.slice(0, 10),
      };
    });
};

export const createProject = (input: Pick<Project, "name" | "type" | "description">) => {
  const project: Project = {
    id: createId("project"),
    name: input.name,
    type: input.type,
    description: input.description,
    status: "待开始",
    createdAt: nowIso(),
  };

  store.update((current) => ({
    ...current,
    projects: [project, ...current.projects],
  }));

  return project;
};

export const deleteProject = (projectId: string) => {
  const current = store.get();
  const project = current.projects.find((item) => item.id === projectId);

  if (!project) {
    throw new Error("项目不存在");
  }

  const projectDocuments = current.documents.filter((item) => item.projectId === projectId);

  projectDocuments.forEach((document) => {
    if (document.storagePath && fs.existsSync(document.storagePath)) {
      fs.rmSync(document.storagePath, { force: true });
    }
  });

  const removedTaskIds = current.reviewTasks
    .filter((task) => task.projectId === projectId)
    .map((task) => task.id);

  store.update((state) => ({
    ...state,
    projects: state.projects.filter((item) => item.id !== projectId),
    documents: state.documents.filter((item) => item.projectId !== projectId),
    reviewTasks: state.reviewTasks.filter((item) => item.projectId !== projectId),
    findings: state.findings.filter((item) => !removedTaskIds.includes(item.taskId)),
  }));

  return { success: true, projectId };
};
