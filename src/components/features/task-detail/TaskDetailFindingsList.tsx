import type { ReactNode } from "react";
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { FindingListItem } from "@/lib/api-types";
import TaskDetailFindingRow from "./TaskDetailFindingRow";

interface TaskDetailFindingsListProps {
  findings: FindingListItem[];
  onSelectFinding: (finding: FindingListItem) => void;
  renderRiskIcon: (risk: FindingListItem["risk"]) => ReactNode;
}

const virtualizationThreshold = 50;

const TaskDetailFindingsList = ({ findings, onSelectFinding, renderRiskIcon }: TaskDetailFindingsListProps) => {
  const enableVirtualization = findings.length >= virtualizationThreshold;
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: findings.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 96,
    overscan: 8,
  });

  if (!enableVirtualization) {
    return (
      <div className="overflow-hidden rounded-[24px] border border-border/80 bg-background/80">
        <div className="divide-y divide-border/80">
          {findings.map((finding) => (
            <TaskDetailFindingRow
              key={finding.id}
              finding={finding}
              onSelect={onSelectFinding}
              renderRiskIcon={renderRiskIcon}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-border/80 bg-background/80">
      <div ref={parentRef} className="max-h-[68vh] overflow-y-auto">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const finding = findings[virtualItem.index];
            return (
              <div
                key={finding.id}
                className="border-b border-border/80 last:border-b-0"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <TaskDetailFindingRow
                  finding={finding}
                  onSelect={onSelectFinding}
                  renderRiskIcon={renderRiskIcon}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TaskDetailFindingsList;
