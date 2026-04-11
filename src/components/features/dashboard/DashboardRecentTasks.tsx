import { ArrowRight, ArrowUpRight, FileSearch } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { DashboardResponse } from "@/lib/api-types";
import { getRiskBadgeVariant } from "@/lib/formatters/review";

interface DashboardRecentTasksProps {
  isError: boolean;
  isLoading: boolean;
  recentTasks: DashboardResponse["recentTasks"];
}

const statusTone = (status: string) => {
  if (status === "已完成") return "text-success";
  if (status === "进行中") return "text-foreground";
  if (status === "失败" || status === "未完成") return "text-destructive";
  return "text-muted-foreground";
};

const DashboardRecentTasks = ({ isError, isLoading, recentTasks }: DashboardRecentTasksProps) => {
  const navigate = useNavigate();

  return (
    <Card className="surface-panel border-border/80 bg-card/85">
      <CardHeader className="pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle className="font-display text-[32px] text-foreground">最近审查任务</CardTitle>
            <CardDescription>快速查看并跟进您最近处理的审查任务进度。</CardDescription>
          </div>
          <Button asChild variant="outline" className="w-fit rounded-full">
            <Link to="/projects">
              查看全部任务
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isError && (
          <div className="rounded-[24px] border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            仪表盘数据加载失败，请刷新后重试。
          </div>
        )}

        {!isError && !isLoading && recentTasks.length === 0 && (
          <div className="rounded-[26px] border border-dashed border-border bg-background/78 p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border/80 bg-background text-primary">
              <FileSearch className="h-6 w-6" />
            </div>
            <h3 className="font-display text-2xl text-foreground">还没有审查任务</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
              从上传资料开始，会自动进入任务编排和风险输出。首页不再强调炫技，而是把最短路径放到最前面。
            </p>
            <Button asChild className="mt-5 rounded-full px-6">
              <Link to="/upload">
                去上传文件
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}

        {!isError &&
          recentTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => navigate(`/tasks/${task.id}`)}
              className="w-full rounded-[24px] border border-border/80 bg-background/78 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_16px_24px_-22px_rgba(24,24,27,0.18)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-foreground">{task.name}</h3>
                    <Badge variant={getRiskBadgeVariant(task.risk)} className="rounded-full">
                      风险 {task.risk}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className={statusTone(task.status)}>{task.status}</span>
                    <span className="text-border">/</span>
                    <span>AI 审查进度 {task.progress}%</span>
                  </div>
                </div>

                <div className="w-full max-w-xs lg:w-64">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>处理进度</span>
                    <span>{task.progress}%</span>
                  </div>
                  <Progress value={task.progress} className="h-2.5" />
                </div>
              </div>
            </button>
          ))}
      </CardContent>
    </Card>
  );
};

export default DashboardRecentTasks;
