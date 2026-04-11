import { ArrowUpRight, BookOpen, FileSearch, FolderKanban } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const quickActions = [
  {
    title: "发起新建审查",
    description: "上传待审查的招/投标文件，立即启动一轮全新的 AI 审查。",
    href: "/upload",
    icon: FileSearch,
  },
  {
    title: "查看项目池",
    description: "浏览所有审查项目，跟进当前进度与历史记录。",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    title: "维护法规依据",
    description: "管理内部制度与外部法规，确保 AI 审查标准准确且保持最新。",
    href: "/regulations",
    icon: BookOpen,
  },
];

const DashboardActions = () => (
  <Card className="surface-panel w-full min-w-0 border-border/80 bg-card/85">
    <CardHeader className="pb-5">
      <CardTitle className="font-display text-[30px] text-foreground">主要入口</CardTitle>
      <CardDescription>快速开启或管理您的审查工作。</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {quickActions.map((action) => (
        <Link
          key={action.title}
          to={action.href}
          className="group flex w-full min-w-0 items-start gap-4 rounded-[24px] border border-border/80 bg-background/78 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_16px_24px_-22px_rgba(24,24,27,0.18)]"
        >
          <div className="rounded-[18px] border border-border/80 bg-background p-3 text-primary">
            <action.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-foreground">{action.title}</h3>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{action.description}</p>
          </div>
        </Link>
      ))}
    </CardContent>
  </Card>
);

export default DashboardActions;
