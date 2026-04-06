import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/api";
import { DashboardResponse } from "@/lib/api-types";

const statIcons = {
  审查项目总数: FileText,
  待处理任务: Clock,
  发现问题: AlertTriangle,
  已完成审查: CheckCircle2,
} as const;

const riskBadgeVariant = (risk: string) => {
  if (risk === "高") return "destructive";
  if (risk === "中") return "secondary";
  return "outline";
};

const statusColor = (status: string) => {
  if (status === "已完成") return "text-success";
  if (status === "进行中") return "text-primary";
  return "text-muted-foreground";
};

const Dashboard = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiRequest<DashboardResponse>("/dashboard"),
  });

  const stats = data?.stats ?? [];
  const recentTasks = data?.recentTasks ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">仪表盘</h1>
        <p className="text-muted-foreground mt-1">招投标文件智能审查平台概览</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading &&
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="border border-border shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">加载中...</p>
              </CardContent>
            </Card>
          ))}

        {!isLoading &&
          stats.map((stat) => {
            const Icon = statIcons[stat.label as keyof typeof statIcons] ?? FileText;

            return (
              <Card key={stat.label} className="border border-border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl bg-secondary ${stat.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    <span className={stat.change.startsWith("+") ? "text-success" : "text-destructive"}>
                      {stat.change}
                    </span>
                    <span>较上月</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>

      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">最近审查任务</CardTitle>
            <button className="text-sm text-primary flex items-center gap-1 hover:underline">
              查看全部 <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {isError && <p className="text-sm text-destructive">仪表盘数据加载失败</p>}
          {!isError && recentTasks.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">暂无任务</p>
          )}
          <div className="space-y-3">
            {recentTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{task.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs font-medium ${statusColor(task.status)}`}>{task.status}</span>
                    <Badge variant={riskBadgeVariant(task.risk)} className="text-xs">
                      风险: {task.risk}
                    </Badge>
                  </div>
                </div>
                <div className="w-32 ml-4">
                  <Progress value={task.progress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1 text-right">{task.progress}%</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
