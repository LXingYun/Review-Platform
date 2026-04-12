import type { BadgeProps } from "@/components/ui/badge";
import type { FindingReviewStage, ReviewTaskStage, RiskLevel } from "@/lib/api-types";

export const getRiskBadgeVariant = (risk: RiskLevel): NonNullable<BadgeProps["variant"]> => {
  if (risk === "\u9ad8") return "destructive";
  if (risk === "\u4e2d") return "secondary";
  return "outline";
};

export const formatReviewStageLabel = (stage: FindingReviewStage) => {
  if (stage === "cross_section_review") return "\u8de8\u7ae0\u8282\u51b2\u7a81";
  if (stage === "response_consistency_review") return "\u54cd\u5e94\u4e00\u81f4\u6027";
  return "\u7ae0\u8282\u5ba1\u67e5";
};

export const formatReviewTaskStageLabel = (stage: ReviewTaskStage) => {
  if (stage === "queued") return "等待后台处理";
  if (stage === "preparing_context") return "准备审核上下文";
  if (stage === "ai_review") return "进行 AI 审查";
  if (stage === "chapter_review") return "进行章节级合规审查";
  if (stage === "cross_section_review") return "进行跨章节一致性检查";
  if (stage === "consolidating") return "整合审查结果";
  if (stage === "completed") return "审查完成";
  if (stage === "failed") return "审查失败";
  if (stage === "aborted") return "任务已中止";
  return "服务中断，任务未完成";
};
