import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileSearch,
  FolderKanban,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/api";
import { DashboardResponse } from "@/lib/api-types";

const statIcons = {
  审查项目总数: FolderKanban,
  待处理任务: Clock3,
  发现问题: AlertTriangle,
  已完成审查: CheckCircle2,
} as const;

const quickActions = [
  {
    title: "发起一轮审查",
    description: "从上传资料开始，把招标或投标文件送进新的审查流程。",
    href: "/upload",
    icon: FileSearch,
  },
  {
    title: "浏览项目池",
    description: "查看正在推进的项目、任务状态和需要继续跟进的条目。",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    title: "维护法规依据",
    description: "补充法规文本、规则条款和支撑材料，维持审查底座。",
    href: "/regulations",
    icon: BookOpen,
  },
];

const editorialNotes = [
  {
    title: "更安静的工作台",
    description: "让进入系统后的第一眼先看到要做什么，而不是被视觉噪音打断。",
    icon: ShieldCheck,
  },
  {
    title: "以复核为中心",
    description: "所有入口最终都指向任务、问题和复核动作，避免信息散落。",
    icon: Scale,
  },
  {
    title: "保留业务密度",
    description: "不牺牲项目管理和任务跟踪能力，只把表达方式改得更克制。",
    icon: Sparkles,
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

const riskBadgeVariant = (risk: string) => {
  if (risk === "高") return "destructive";
  if (risk === "中") return "secondary";
  return "outline";
};

const statusTone = (status: string) => {
  if (status === "已完成") return "text-success";
  if (status === "进行中") return "text-stone-900";
  if (status === "失败" || status === "未完成") return "text-destructive";
  return "text-muted-foreground";
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiRequest<DashboardResponse>("/dashboard"),
  });

  const stats = data?.stats ?? [];
  const recentTasks = data?.recentTasks ?? [];

  return (
    <div className="space-y-10 pb-8">
      <section className="surface-paper relative overflow-hidden rounded-[36px] px-6 py-8 md:px-10 md:py-10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-stone-400/50 to-transparent" />
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(188,149,92,0.14),transparent_68%)]" />
        <div className="absolute left-0 top-20 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.5),transparent_70%)]" />

        <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_360px]">
          <div className="space-y-7">
            <div className="space-y-4">
              <span className="eyebrow">AI Review Workspace</span>
              <div className="max-w-4xl space-y-4">
                <h1 className="font-display text-4xl leading-[1.05] text-stone-950 md:text-6xl">
                  把招投标审查
                  <span className="block text-[hsl(var(--accent))]">变成一条连续、可复核的工作流</span>
                </h1>
                <p className="max-w-2xl text-base leading-8 text-stone-600 md:text-lg">
                  这里不是传统的数据大盘，而是一张更安静的工作台首页。上传资料、推进任务、查看风险，再回到人工复核，
                  每一步都在同一个语境里完成。
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-full px-6 shadow-[0_18px_34px_-22px_rgba(28,25,23,0.6)]">
                <Link to="/upload">
                  立即发起审查
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-full border-stone-300 bg-white/60 px-6 hover:bg-white">
                <Link to="/projects">
                  查看项目池
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {editorialNotes.map((note) => (
                <div key={note.title} className="rounded-[24px] border border-stone-200/90 bg-white/72 p-4">
                  <div className="mb-4 inline-flex rounded-full border border-stone-200 bg-stone-100/80 p-2.5 text-stone-700">
                    <note.icon className="h-4 w-4" />
                  </div>
                  <h2 className="text-base font-semibold text-stone-900">{note.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{note.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-stone-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,244,236,0.9))] p-5 shadow-[0_18px_34px_-28px_rgba(28,25,23,0.4)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-stone-500">今日视图</p>
                <h2 className="mt-2 font-display text-3xl text-stone-950">工作台总览</h2>
              </div>
              <div className="rounded-full bg-stone-950 p-2.5 text-stone-50">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {isLoading &&
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="rounded-[22px] border border-stone-200 bg-white/70 p-4">
                    <div className="h-3 w-24 rounded-full bg-stone-200/80" />
                    <div className="mt-3 h-7 w-16 rounded-full bg-stone-200/80" />
                  </div>
                ))}

              {!isLoading &&
                stats.slice(0, 3).map((stat) => {
                  const Icon = statIcons[stat.label as keyof typeof statIcons] ?? FolderKanban;

                  return (
                    <div key={stat.label} className="rounded-[22px] border border-stone-200 bg-white/70 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm text-stone-500">{stat.label}</p>
                          <p className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">{stat.value}</p>
                        </div>
                        <div className="rounded-full border border-stone-200 bg-stone-50 p-3 text-stone-700">
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="mt-5 rounded-[22px] border border-stone-200 bg-stone-950 px-4 py-4 text-stone-50">
              <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Flow</p>
              <p className="mt-2 text-sm leading-7 text-stone-200">
                首页负责指路，任务详情负责落地。你可以把这里理解成一张前台安静、后台高效的审查入口页。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading &&
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="bg-white/72">
              <CardContent className="p-5">
                <div className="h-3 w-20 rounded-full bg-stone-200/80" />
                <div className="mt-4 h-8 w-16 rounded-full bg-stone-200/80" />
              </CardContent>
            </Card>
          ))}

        {!isLoading &&
          stats.map((stat) => {
            const Icon = statIcons[stat.label as keyof typeof statIcons] ?? FolderKanban;

            return (
              <Card key={stat.label} className="bg-white/72">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-stone-500">{stat.label}</p>
                      <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">{stat.value}</p>
                    </div>
                    <div className="rounded-full border border-stone-200 bg-stone-50 p-3 text-stone-700">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="bg-white/72">
          <CardHeader className="pb-5">
            <CardTitle className="font-display text-[30px] text-stone-950">主要入口</CardTitle>
            <CardDescription>先决定你要做哪件事，再进入对应流程。减少导航噪音，让首屏更像入口而不是说明书。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                to={action.href}
                className="group flex items-start gap-4 rounded-[24px] border border-stone-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,242,233,0.88))] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_16px_24px_-22px_rgba(28,25,23,0.38)]"
              >
                <div className="rounded-[18px] border border-stone-200 bg-white/90 p-3 text-stone-800">
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-stone-950">{action.title}</h3>
                    <ArrowUpRight className="h-4 w-4 text-stone-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-stone-900" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{action.description}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-white/72">
          <CardHeader className="pb-5">
            <CardTitle className="font-display text-[30px] text-stone-950">使用节奏</CardTitle>
            <CardDescription>把上传、AI 审查和人工复核串成一条连续的工作流，减少来回切换成本。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {processSteps.map((item) => (
              <div key={item.step} className="rounded-[24px] border border-stone-200/90 bg-white/82 p-4">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-sm font-semibold text-stone-900">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-950">{item.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-stone-600">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="bg-white/72">
          <CardHeader className="pb-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle className="font-display text-[32px] text-stone-950">最近审查任务</CardTitle>
                <CardDescription>仍然保留任务密度，但用更平静的版式承载状态、风险和进度。</CardDescription>
              </div>
              <Button asChild variant="outline" className="w-fit rounded-full border-stone-300 bg-white/70 hover:bg-white">
                <Link to="/projects">
                  查看全部任务
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isError && (
              <div className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                仪表盘数据加载失败，请刷新后重试。
              </div>
            )}

            {!isError && !isLoading && recentTasks.length === 0 && (
              <div className="rounded-[26px] border border-dashed border-stone-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(246,241,233,0.82))] p-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-stone-200 bg-white/90 text-stone-800">
                  <FileSearch className="h-6 w-6" />
                </div>
                <h3 className="font-display text-2xl text-stone-950">还没有审查任务</h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-stone-600">
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
                  className="w-full rounded-[24px] border border-stone-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,242,233,0.88))] p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_16px_24px_-22px_rgba(28,25,23,0.38)]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-stone-950">{task.name}</h3>
                        <Badge variant={riskBadgeVariant(task.risk)} className="rounded-full">
                          风险 {task.risk}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-stone-500">
                        <span className={statusTone(task.status)}>{task.status}</span>
                        <span className="text-stone-300">/</span>
                        <span>AI 审查进度 {task.progress}%</span>
                      </div>
                    </div>

                    <div className="w-full max-w-xs lg:w-64">
                      <div className="mb-2 flex items-center justify-between text-xs text-stone-500">
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
      </section>
    </div>
  );
};

export default Dashboard;
