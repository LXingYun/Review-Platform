import { store } from "../store";

export const getDashboardSummary = () => {
  const data = store.get();
  const pendingCount = data.reviewTasks.filter((task) => task.status !== "已完成").length;
  const completedCount = data.reviewTasks.filter((task) => task.status === "已完成").length;

  return {
    stats: [
      {
        label: "审查项目总数",
        value: String(data.projects.length),
        color: "text-primary",
      },
      {
        label: "待处理任务",
        value: String(pendingCount),
        color: "text-warning",
      },
      {
        label: "发现问题",
        value: String(data.findings.length),
        color: "text-destructive",
      },
      {
        label: "已完成审查",
        value: String(completedCount),
        color: "text-success",
      },
    ],
    recentTasks: data.reviewTasks
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
