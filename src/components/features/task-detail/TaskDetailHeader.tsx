import { Link } from "react-router-dom";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import type { ReviewTaskDetailItem } from "@/lib/api-types";

interface TaskDetailHeaderProps {
  task: ReviewTaskDetailItem;
  taskId: string;
  abortPending: boolean;
  retryPending: boolean;
  deletePending: boolean;
  onAbortTask: (taskId: string) => void;
  onRetryTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

const TaskDetailHeader = ({
  task,
  taskId,
  abortPending,
  retryPending,
  deletePending,
  onAbortTask,
  onRetryTask,
  onDeleteTask,
}: TaskDetailHeaderProps) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" className="rounded-full" asChild>
        <Link to={`/projects/${task.projectId}`}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Button>
      <div>
        <div className="mb-2">
          <span className="eyebrow">审查任务</span>
        </div>
        <h1 className="font-display text-4xl leading-[1.08] text-foreground md:text-5xl">{task.name}</h1>
        <p className="mt-1 text-muted-foreground">任务详情、关联文件与问题清单</p>
      </div>
    </div>

    <div className="flex items-center gap-2">
      {(task.status === "待审核" || task.status === "进行中") && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={abortPending}>
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
              <AlertDialogAction onClick={() => onAbortTask(taskId)}>确认中止</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {(task.status === "失败" || task.status === "未完成") && (
        <Button variant="outline" disabled={retryPending} onClick={() => onRetryTask(taskId)}>
          <RotateCcw className="mr-2 h-4 w-4" />
          重新执行
        </Button>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={deletePending}>
            <Trash2 className="mr-2 h-4 w-4" />
            删除任务
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除审查任务？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后会同步移除该任务对应的问题结果，但不会删除原始上传文件。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDeleteTask(taskId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </div>
);

export default TaskDetailHeader;
