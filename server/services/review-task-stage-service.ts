import type { ReviewTask, ReviewTaskStage } from "../types";

const stageLabels: Record<ReviewTaskStage, string> = {
  queued: "等待后台处理",
  preparing_context: "准备审核上下文",
  ai_review: "进行 AI 审查",
  chapter_review: "进行章节级合规审查",
  cross_section_review: "进行跨章节一致性检查",
  consolidating: "整合审查结果",
  completed: "审查完成",
  failed: "审查失败",
  aborted: "任务已中止",
  interrupted: "服务中断，任务未完成",
};

export const getReviewTaskStageLabel = (stage: ReviewTaskStage) => stageLabels[stage];

export const inferReviewTaskStage = (
  task: Pick<ReviewTask, "status" | "scenario" | "stageLabel" | "progress">,
): ReviewTaskStage => {
  if (task.status === "待审核") return "queued";
  if (task.status === "已完成") return "completed";
  if (task.status === "失败") return "failed";

  if (task.status === "未完成") {
    if (task.stageLabel.includes("中止")) return "aborted";
    if (task.stageLabel.includes("服务中断")) return "interrupted";
    return "aborted";
  }

  if (task.stageLabel.includes("跨章节")) return "cross_section_review";
  if (task.stageLabel.includes("章节")) return "chapter_review";
  if (task.stageLabel.includes("整合")) return "consolidating";
  if (task.stageLabel.includes("准备")) return "preparing_context";

  if (task.scenario === "tender_compliance") {
    return task.progress < 45 ? "preparing_context" : "chapter_review";
  }

  return task.progress < 45 ? "preparing_context" : "ai_review";
};
