import fs from "node:fs";
import { store } from "../store";
import { Project, ProjectStatus, ReviewTaskStatus } from "../types";
import { createId, nowIso } from "../utils";
import { assertProjectAccess, filterProjectsForActor, resolveActor } from "./access-control-service";
import type { AuthActor } from "./auth-types";
import { reviewTaskStatusText } from "./review-task-messages";

const activeTaskStatuses = new Set<ReviewTaskStatus>([
  reviewTaskStatusText.queued,
  reviewTaskStatusText.running,
]);
const unfinishedTaskStatuses = new Set<ReviewTaskStatus>([
  reviewTaskStatusText.failed,
  reviewTaskStatusText.unfinished,
]);

const deriveProjectStatus = (
  projectId: string,
  reviewTasks: Array<{ projectId: string; status: ReviewTaskStatus }>,
): ProjectStatus => {
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

const findLatestProjectCompletedAt = (
  projectId: string,
  reviewTasks: Array<{ projectId: string; status: ReviewTaskStatus; completedAt: string | null }>,
) =>
  reviewTasks
    .filter(
      (task) =>
        task.projectId === projectId &&
        task.status === reviewTaskStatusText.completed &&
        Boolean(task.completedAt),
    )
    .map((task) => task.completedAt!)
    .sort((a, b) => b.localeCompare(a))[0] ?? null;

export const listProjects = (search?: string, actor?: AuthActor) => {
  const accessActor = resolveActor(actor);
  const data = store.get();
  const keyword = search?.trim();
  const projects = filterProjectsForActor(accessActor, data.projects);

  return projects
    .filter((project) => {
      if (!keyword) return true;
      return project.name.includes(keyword) || project.type.includes(keyword);
    })
    .map((project) => {
      const taskCount = data.reviewTasks.filter((task) => task.projectId === project.id).length;
      const issueCount = data.findings.filter((finding) => finding.projectId === project.id).length;
      const latestReviewCompletedAt = findLatestProjectCompletedAt(project.id, data.reviewTasks);

      return {
        ...project,
        status: deriveProjectStatus(project.id, data.reviewTasks),
        taskCount,
        issueCount,
        date: (latestReviewCompletedAt ?? project.createdAt).slice(0, 10),
        latestReviewCompletedAt,
      };
    });
};

export const createProject = (input: Pick<Project, "name" | "type" | "description">, actor?: AuthActor) => {
  const accessActor = resolveActor(actor);
  const project: Project = {
    id: createId("project"),
    name: input.name,
    type: input.type,
    description: input.description,
    status: "待开始",
    ownerUserId: accessActor.id || undefined,
    createdAt: nowIso(),
  };

  store.update((current) => ({
    ...current,
    projects: [project, ...current.projects],
  }));

  return project;
};

export const deleteProject = (projectId: string, actor?: AuthActor) => {
  const accessActor = resolveActor(actor);
  const current = store.get();
  assertProjectAccess(accessActor, projectId, current);

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
