import { store } from "../store";
import type { AppData } from "../types";
import type { AuthActor } from "./auth-types";
import { notFound } from "./http-error";

const systemActor: AuthActor = {
  id: "",
  username: "system",
  role: "admin",
};

export const resolveActor = (actor?: AuthActor) => actor ?? systemActor;

export const filterProjectsForActor = (actor: AuthActor, projects: AppData["projects"]) => {
  if (actor.role === "admin") {
    return projects;
  }

  return projects.filter((project) => project.ownerUserId === actor.id);
};

export const getAccessibleProjectIdSet = (actor: AuthActor, data = store.get()) =>
  new Set(filterProjectsForActor(actor, data.projects).map((project) => project.id));

export const filterTasksForActor = (actor: AuthActor, tasks: AppData["reviewTasks"], data = store.get()) => {
  const accessibleProjectIds = getAccessibleProjectIdSet(actor, data);
  return tasks.filter((task) => accessibleProjectIds.has(task.projectId));
};

export const assertProjectAccess = (actor: AuthActor, projectId: string, data = store.get()) => {
  const project = data.projects.find((item) => item.id === projectId);
  if (!project) {
    throw notFound("Project not found.");
  }

  if (actor.role === "admin") {
    return project;
  }

  if (project.ownerUserId !== actor.id) {
    throw notFound("Project not found.");
  }

  return project;
};

export const assertTaskAccess = (actor: AuthActor, taskId: string, data = store.get()) => {
  const task = data.reviewTasks.find((item) => item.id === taskId);
  if (!task) {
    throw notFound("Task not found.");
  }

  assertProjectAccess(actor, task.projectId, data);
  return task;
};

export const assertDocumentAccess = (actor: AuthActor, documentId: string, data = store.get()) => {
  const document = data.documents.find((item) => item.id === documentId);
  if (!document) {
    throw notFound("Document not found.");
  }

  assertProjectAccess(actor, document.projectId, data);
  return document;
};

export const assertFindingAccess = (actor: AuthActor, findingId: string, data = store.get()) => {
  const finding = data.findings.find((item) => item.id === findingId);
  if (!finding) {
    throw notFound("Finding not found.");
  }

  assertTaskAccess(actor, finding.taskId, data);
  return finding;
};
