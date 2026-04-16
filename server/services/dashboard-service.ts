import { store } from "../store";
import { getAccessibleProjectIdSet, resolveActor } from "./access-control-service";
import type { AuthActor } from "./auth-types";
import { reviewTaskStatusText } from "./review-task-messages";

export const getDashboardSummary = (actor?: AuthActor) => {
  const accessActor = resolveActor(actor);
  const data = store.get();
  const accessibleProjectIds = getAccessibleProjectIdSet(accessActor, data);

  const visibleProjects = data.projects.filter((project) => accessibleProjectIds.has(project.id));
  const visibleTasks = data.reviewTasks.filter((task) => accessibleProjectIds.has(task.projectId));
  const visibleFindings = data.findings.filter((finding) => accessibleProjectIds.has(finding.projectId));

  const pendingCount = visibleTasks.filter((task) => task.status !== reviewTaskStatusText.completed).length;
  const completedCount = visibleTasks.filter((task) => task.status === reviewTaskStatusText.completed).length;

  return {
    stats: [
      {
        label: "审查项目总数",
        value: String(visibleProjects.length),
        color: "text-primary",
      },
      {
        label: "待处理任务",
        value: String(pendingCount),
        color: "text-warning",
      },
      {
        label: "发现问题",
        value: String(visibleFindings.length),
        color: "text-destructive",
      },
      {
        label: "已完成审查",
        value: String(completedCount),
        color: "text-success",
      },
    ],
    recentTasks: visibleTasks
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((task) => ({
        id: task.id,
        name: task.name,
        status: task.status,
        stage: task.stage,
        stageLabel: task.stageLabel,
        risk: task.riskLevel,
        progress: task.progress,
      })),
  };
};
