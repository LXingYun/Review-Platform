import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const stats = [
  { label: "审查项目总数", value: "128", icon: FileText, change: "+12%", color: "text-primary" },
  { label: "待处理任务", value: "23", icon: Clock, change: "-5%", color: "text-warning" },
  { label: "发现问题", value: "347", icon: AlertTriangle, change: "+8%", color: "text-destructive" },
  { label: "已完成审查", value: "96", icon: CheckCircle2, change: "+15%", color: "text-success" },
];

const recentTasks = [
  { id: 1, name: "XX市政工程招标文件审查", status: "进行中", risk: "高", progress: 65 },
  { id: 2, name: "医疗设备采购投标文件审查", status: "待审查", risk: "中", progress: 0 },
  { id: 3, name: "智慧城市项目招标合规审查", status: "已完成", risk: "低", progress: 100 },
  { id: 4, name: "高速公路建设投标资质审查", status: "进行中", risk: "高", progress: 40 },
  { id: 5, name: "学校建设工程招标文件复核", status: "已完成", risk: "中", progress: 100 },
];

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
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">仪表盘</h1>
        <p className="text-muted-foreground mt-1">招投标文件智能审查平台概览</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border border-border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl bg-secondary ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
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
        ))}
      </div>

      {/* Recent Tasks */}
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
