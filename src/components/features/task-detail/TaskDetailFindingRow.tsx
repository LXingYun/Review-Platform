import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { FindingListItem } from "@/lib/api-types";
import { formatReviewStageLabel, getRiskBadgeVariant } from "@/lib/formatters/review";

interface TaskDetailFindingRowProps {
  finding: FindingListItem;
  onSelect: (finding: FindingListItem) => void;
  renderRiskIcon: (risk: FindingListItem["risk"]) => ReactNode;
}

const TaskDetailFindingRow = ({ finding, onSelect, renderRiskIcon }: TaskDetailFindingRowProps) => (
  <div
    className="flex cursor-pointer items-center justify-between gap-4 p-4 transition-colors hover:bg-background"
    onClick={() => onSelect(finding)}
  >
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background">
        {renderRiskIcon(finding.risk)}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{finding.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{finding.location}</p>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Badge variant="outline">{formatReviewStageLabel(finding.reviewStage)}</Badge>
      <Badge variant={getRiskBadgeVariant(finding.risk)}>{finding.risk}风险</Badge>
      {finding.needsHumanReview && <Badge variant="outline">需复核</Badge>}
      <Badge variant="outline" className="text-xs">
        {finding.status}
      </Badge>
    </div>
  </div>
);

export default TaskDetailFindingRow;
