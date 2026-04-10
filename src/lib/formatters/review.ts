import type { BadgeProps } from "@/components/ui/badge";
import type { FindingReviewStage, RiskLevel } from "@/lib/api-types";

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
