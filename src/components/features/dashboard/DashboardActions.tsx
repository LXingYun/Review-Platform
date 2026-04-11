import { ArrowUpRight, BookOpen, FileSearch, FolderKanban } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const quickActions = [
  {
    title: "发起新建审查",
    description: "从上传资料开始，把招标文件或投标文件送进一轮新的审查流程。",
    href: "/upload",
    icon: FileSearch,
  },
  {
    title: "查看项目池",
    description: "查看正在推进的项目、任务状态和需要继续跟进的条目。",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    title: "维护法规依据",
    description: "补充法规文本、规则条款和支持材料，维持审查底座。",
    href: "/regulations",
    icon: BookOpen,
  },
];

const processSteps = [
  {
    step: "01",
    title: "归档资料",
    description: "先选项目，再上传招标文件、投标文件或补充材料。",
  },
  {
    step: "02",
    title: "生成审查任务",
    description: "系统把文档解析、抽取和 AI 审查编排成一条连续流程。",
  },
  {
    step: "03",
    title: "进入人工复核",
    description: "在任务详情中查看风险、补充备注，并完成最终判断。",
  },
];

const DashboardActions = () => (
  <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
    <Card className="surface-panel border-border/80 bg-card/85">
      <CardHeader className="pb-5">
        <CardTitle className="font-display text-[30px] text-foreground">主要入口</CardTitle>
        <CardDescription>先决定你要做哪件事，再进入对应流程。减少导航噪音，让首屏更像入口而不是说明书。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {quickActions.map((action) => (
          <Link
            key={action.title}
            to={action.href}
            className="group flex items-start gap-4 rounded-[24px] border border-border/80 bg-background/78 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_16px_24px_-22px_rgba(24,24,27,0.18)]"
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

    <Card className="surface-panel border-border/80 bg-card/85">
      <CardHeader className="pb-5">
        <CardTitle className="font-display text-[30px] text-foreground">使用节奏</CardTitle>
        <CardDescription>把上传、AI 审查和人工复核串成一条连续的工作流，减少来回切换成本。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {processSteps.map((item) => (
          <div key={item.step} className="rounded-[24px] border border-border/80 bg-background/78 p-4">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-sm font-semibold text-foreground">
                {item.step}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  </section>
);

export default DashboardActions;
