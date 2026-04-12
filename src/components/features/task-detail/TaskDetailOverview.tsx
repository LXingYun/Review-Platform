import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ReviewTaskDetailItem } from "@/lib/api-types";
import { formatIsoDateTime } from "@/lib/formatters/date";
import { formatReviewTaskStageLabel, getRiskBadgeVariant } from "@/lib/formatters/review";

interface TaskDetailOverviewProps {
  task: ReviewTaskDetailItem;
  relatedDocumentsCount: number;
  findingsCount: number;
}

const TaskDetailOverview = ({ task, relatedDocumentsCount, findingsCount }: TaskDetailOverviewProps) => (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
    <Card className="surface-paper bg-card/85 lg:col-span-2">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{task.projectName}</Badge>
          <Badge variant="outline">{task.scenario === "tender_compliance" ? "招标审查" : "投标审查"}</Badge>
          <Badge variant={getRiskBadgeVariant(task.riskLevel)}>{task.riskLevel}风险</Badge>
          {task.attemptCount > 1 && <Badge variant="outline">第 {task.attemptCount} 次执行</Badge>}
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>任务状态：{task.status}</p>
          <p>当前阶段：{task.stageLabel || formatReviewTaskStageLabel(task.stage)}</p>
          <p>创建时间：{formatIsoDateTime(task.createdAt)}</p>
          <p>完成时间：{task.completedAt ? formatIsoDateTime(task.completedAt) : "未完成"}</p>
          <p>进度：{task.progress}%</p>
        </div>
        <div className="pt-2">
          <Progress value={task.progress} className="h-2.5" />
        </div>
      </CardContent>
    </Card>

    <Card className="surface-panel bg-card/85">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">概况</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="flex justify-between">
          <span className="text-muted-foreground">关联文件</span>
          <span className="font-medium text-foreground">{relatedDocumentsCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">问题数量</span>
          <span className="font-medium text-foreground">{findingsCount}</span>
        </div>
      </CardContent>
    </Card>
  </div>
);

interface TaskDetailRiskSummaryProps {
  highCount: number;
  midCount: number;
  lowCount: number;
}

export const TaskDetailRiskSummary = ({ highCount, midCount, lowCount }: TaskDetailRiskSummaryProps) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    <Card className="border-destructive/20 bg-destructive/5 shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <XCircle className="h-8 w-8 text-destructive" />
        <div>
          <p className="text-2xl font-bold text-destructive">{highCount}</p>
          <p className="text-sm text-muted-foreground">高风险</p>
        </div>
      </CardContent>
    </Card>

    <Card className="border-warning/20 bg-warning/5 shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <AlertTriangle className="h-8 w-8 text-warning" />
        <div>
          <p className="text-2xl font-bold text-warning">{midCount}</p>
          <p className="text-sm text-muted-foreground">中风险</p>
        </div>
      </CardContent>
    </Card>

    <Card className="border-success/20 bg-success/5 shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <CheckCircle2 className="h-8 w-8 text-success" />
        <div>
          <p className="text-2xl font-bold text-success">{lowCount}</p>
          <p className="text-sm text-muted-foreground">低风险</p>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default TaskDetailOverview;
