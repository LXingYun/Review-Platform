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
        change: "+12%",
        color: "text-primary",
      },
      {
        label: "待处理任务",
        value: String(pendingCount),
        change: "-5%",
        color: "text-warning",
      },
      {
        label: "发现问题",
        value: String(data.findings.length),
        change: "+8%",
        color: "text-destructive",
      },
      {
        label: "已完成审查",
        value: String(completedCount),
        change: "+15%",
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
        risk: task.riskLevel,
        progress: task.progress,
      })),
  };
};
