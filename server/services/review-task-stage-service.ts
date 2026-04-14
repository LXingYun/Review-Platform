import type { ReviewTask, ReviewTaskStage } from "../types";
import { getReviewTaskStageLabelText, reviewTaskStatusText } from "./review-task-messages";

export const getReviewTaskStageLabel = (stage: ReviewTaskStage) => getReviewTaskStageLabelText(stage);

export const inferReviewTaskStage = (
  task: Pick<ReviewTask, "status" | "scenario" | "stageLabel" | "progress">,
): ReviewTaskStage => {
  if (task.status === reviewTaskStatusText.queued) return "queued";
  if (task.status === reviewTaskStatusText.completed) return "completed";
  if (task.status === reviewTaskStatusText.failed) return "failed";

  if (task.status === reviewTaskStatusText.unfinished) {
    if (task.stageLabel.includes("\u4e2d\u6b62")) return "aborted";
    if (task.stageLabel.includes("\u670d\u52a1\u4e2d\u65ad")) return "interrupted";
    return "aborted";
  }

  if (task.stageLabel.includes("\u8de8\u7ae0\u8282")) return "cross_section_review";
  if (task.stageLabel.includes("\u7ae0\u8282")) return "chapter_review";
  if (task.stageLabel.includes("\u6574\u5408")) return "consolidating";
  if (task.stageLabel.includes("\u51c6\u5907")) return "preparing_context";

  if (task.scenario === "tender_compliance") {
    return task.progress < 45 ? "preparing_context" : "chapter_review";
  }

  return task.progress < 45 ? "preparing_context" : "ai_review";
};
