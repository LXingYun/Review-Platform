import { FileSearch, RotateCcw, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReviewTaskItem } from "@/lib/api-types";
import { getRiskBadgeVariant } from "@/lib/formatters/review";

interface ProjectTasksCardProps {
  tasksLoading: boolean;
  tasks: ReviewTaskItem[];
  abortPending: boolean;
  retryPending: boolean;
  deletePending: boolean;
  onAbortTask: (taskId: string) => void;
  onRetryTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenTask: (taskId: string) => void;
}

const ProjectTasksCard = ({
  tasksLoading,
  tasks,
  abortPending,
  retryPending,
  deletePending,
  onAbortTask,
  onRetryTask,
  onDeleteTask,
  onOpenTask,
}: ProjectTasksCardProps) => (
  <Card className="surface-panel border-border/80 bg-card/90">
    <CardHeader className="pb-4">
      <CardTitle className="font-display text-[28px] text-foreground">审查任务</CardTitle>
      <CardDescription>查看本项目的历史审查记录、风险评级，并点击进入复核详情。</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {tasksLoading && <p className="text-sm text-muted-foreground">任务加载中...</p>}
      {!tasksLoading && tasks.length === 0 && <p className="text-sm text-muted-foreground">当前项目还没有审查任务。</p>}
      {tasks.map((task) => (
        <div key={task.id} className="rounded-[24px] border border-border/80 bg-background/80 p-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-foreground">{task.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {task.scenario === "tender_compliance" ? "招标审查" : "投标审查"} · {task.createdAt.slice(0, 10)}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">当前阶段：{task.stageLabel}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Badge variant="outline">{task.status}</Badge>
                <Badge variant={getRiskBadgeVariant(task.riskLevel)}>{task.riskLevel}风险</Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(task.status === "待审核" || task.status === "进行中") && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={abortPending}>
                      中止任务
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>中止当前任务？</AlertDialogTitle>
                      <AlertDialogDescription>
                        中止后任务会标记为未完成，当前审查结果不会保留，你可以稍后重新执行。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onAbortTask(task.id)}>确认中止</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {(task.status === "失败" || task.status === "未完成") && (
                <Button size="sm" variant="outline" disabled={retryPending} onClick={() => onRetryTask(task.id)}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  重新执行
                </Button>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={deletePending}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除任务
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>删除审查任务？</AlertDialogTitle>
                    <AlertDialogDescription>
                      删除后会同时移除该任务产生的问题结果，但不会删除原始上传文件。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDeleteTask(task.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      确认删除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button size="sm" variant="outline" onClick={() => onOpenTask(task.id)}>
                <FileSearch className="mr-2 h-4 w-4" />
                查看任务
              </Button>
            </div>
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

export default ProjectTasksCard;
