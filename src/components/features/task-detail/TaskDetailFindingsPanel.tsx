import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FindingListItem } from "@/lib/api-types";
import TaskDetailFindingRow from "./TaskDetailFindingRow";
import { TaskDetailRiskSummary } from "./TaskDetailOverview";

interface TaskDetailFindingsPanelProps {
  findingsLoading: boolean;
  filteredFindings: FindingListItem[];
  highCount: number;
  midCount: number;
  lowCount: number;
  search: string;
  humanReviewFilter: "all" | "needs_review" | "no_review";
  confidenceFilter: "all" | "ge_80" | "ge_60" | "lt_60";
  onSearchChange: (value: string) => void;
  onHumanReviewFilterChange: (value: "all" | "needs_review" | "no_review") => void;
  onConfidenceFilterChange: (value: "all" | "ge_80" | "ge_60" | "lt_60") => void;
  onSelectFinding: (finding: FindingListItem) => void;
  renderRiskIcon: (risk: FindingListItem["risk"]) => ReactNode;
}

const tabStatuses: Record<"all" | "cross" | "pending" | "confirmed" | "ignored", FindingListItem["status"] | null> = {
  all: null,
  cross: null,
  pending: "待复核",
  confirmed: "已确认",
  ignored: "已忽略",
};

const TaskDetailFindingsPanel = ({
  findingsLoading,
  filteredFindings,
  highCount,
  midCount,
  lowCount,
  search,
  humanReviewFilter,
  confidenceFilter,
  onSearchChange,
  onHumanReviewFilterChange,
  onConfidenceFilterChange,
  onSelectFinding,
  renderRiskIcon,
}: TaskDetailFindingsPanelProps) => (
  <Card className="border border-border shadow-sm">
    <CardHeader className="pb-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="text-base">问题清单</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">在任务详情页内直接查看、筛选和复核当前任务的问题结果。</p>
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <TaskDetailRiskSummary highCount={highCount} midCount={midCount} lowCount={lowCount} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索问题..." value={search} onChange={(event) => onSearchChange(event.target.value)} className="pl-10" />
        </div>

        <Select value={humanReviewFilter} onValueChange={(value) => onHumanReviewFilterChange(value as typeof humanReviewFilter)}>
          <SelectTrigger className="w-[180px] rounded-[18px] border-border bg-background">
            <SelectValue placeholder="人工复核筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部复核状态</SelectItem>
            <SelectItem value="needs_review">仅需人工复核</SelectItem>
            <SelectItem value="no_review">仅无需人工复核</SelectItem>
          </SelectContent>
        </Select>

        <Select value={confidenceFilter} onValueChange={(value) => onConfidenceFilterChange(value as typeof confidenceFilter)}>
          <SelectTrigger className="w-[180px] rounded-[18px] border-border bg-background">
            <SelectValue placeholder="置信度筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部置信度</SelectItem>
            <SelectItem value="ge_80">80% 以上</SelectItem>
            <SelectItem value="ge_60">60% 以上</SelectItem>
            <SelectItem value="lt_60">60% 以下</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">全部 ({filteredFindings.length})</TabsTrigger>
          <TabsTrigger value="cross">跨章节冲突</TabsTrigger>
          <TabsTrigger value="pending">待复核</TabsTrigger>
          <TabsTrigger value="confirmed">已确认</TabsTrigger>
          <TabsTrigger value="ignored">已忽略</TabsTrigger>
        </TabsList>

        {(["all", "cross", "pending", "confirmed", "ignored"] as const).map((tab) => {
          const tabFiltered = filteredFindings.filter((finding) => {
            if (tab === "cross" && finding.reviewStage !== "cross_section_review") return false;
            return !tabStatuses[tab] || finding.status === tabStatuses[tab];
          });

          return (
            <TabsContent key={tab} value={tab} className="mt-4">
              {findingsLoading ? (
                <p className="p-4 text-sm text-muted-foreground">问题加载中...</p>
              ) : tabFiltered.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">当前筛选条件下暂无问题。</p>
              ) : (
                <div className="overflow-hidden rounded-[24px] border border-border/80 bg-background/80">
                  <div className="divide-y divide-border/80">
                    {tabFiltered.map((finding) => (
                      <TaskDetailFindingRow
                        key={finding.id}
                        finding={finding}
                        onSelect={onSelectFinding}
                        renderRiskIcon={renderRiskIcon}
                      />
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </CardContent>
  </Card>
);

export default TaskDetailFindingsPanel;
