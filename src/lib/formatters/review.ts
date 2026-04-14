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
  if (stage === "queued") return "\u7b49\u5f85\u540e\u53f0\u5904\u7406";
  if (stage === "preparing_context") return "\u51c6\u5907\u5ba1\u6838\u4e0a\u4e0b\u6587";
  if (stage === "ai_review") return "\u8fdb\u884c AI \u5ba1\u67e5";
  if (stage === "chapter_review") return "\u8fdb\u884c\u7ae0\u8282\u7ea7\u5408\u89c4\u5ba1\u67e5";
  if (stage === "cross_section_review") return "\u8fdb\u884c\u8de8\u7ae0\u8282\u4e00\u81f4\u6027\u68c0\u67e5";
  if (stage === "consolidating") return "\u6574\u5408\u5ba1\u67e5\u7ed3\u679c";
  if (stage === "completed") return "\u5ba1\u67e5\u5b8c\u6210";
  if (stage === "failed") return "\u5ba1\u67e5\u5931\u8d25";
  if (stage === "aborted") return "\u4efb\u52a1\u5df2\u4e2d\u6b62";
  return "\u670d\u52a1\u4e2d\u65ad\uff0c\u4efb\u52a1\u672a\u5b8c\u6210";
};
