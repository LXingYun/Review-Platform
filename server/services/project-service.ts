import fs from "node:fs";
import { store } from "../store";
import { Project } from "../types";
import { createId, nowIso } from "../utils";

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

  store.update((state) => ({
    ...state,
    projects: state.projects.filter((item) => item.id !== projectId),
    documents: state.documents.filter((item) => item.projectId !== projectId),
    reviewTasks: state.reviewTasks.filter((item) => item.projectId !== projectId),
    findings: state.findings.filter((item) => item.projectId !== projectId),
  }));

  return { success: true, projectId };
};
