import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bot,
  Building2,
  CheckCircle2,
  Clock3,
  FileSearch,
  FolderKanban,
  Landmark,
  ShieldCheck,
  Sparkles,
  TrendingUp,
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
    title: "发起文件审查",
    description: "上传 PDF 或 Word，进入招标/投标审查流程。",
    href: "/upload",
    icon: FileSearch,
  },
  {
    title: "查看项目池",
    description: "统一管理项目、任务与审查进度。",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    title: "维护法规库",
    description: "查看法规条文、更新基础规则和支撑材料。",
    href: "/regulations",
    icon: BookOpen,
  },
];

const capabilityPanels = [
  {
    title: "审查更可信",
    description: "聚焦风险、进度和留痕，让关键状态进入首页第一视野。",
    icon: ShieldCheck,
  },
  {
    title: "AI 为主引擎",
    description: "从上传、章节审查到问题输出，统一走 AI 审查链路。",
    icon: Bot,
  },
  {
    title: "信息表达更清晰",
    description: "用更克制的层级和留白呈现状态、结果与后续动作。",
    icon: Landmark,
  },
];

const processSteps = [
  {
    step: "01",
    title: "上传资料",
    description: "把招标文件或投标文件拖入平台，完成解析与归档。",
  },
  {
    step: "02",
    title: "AI 审查",
    description: "系统按章节推进审查，识别高风险条款与一致性问题。",
  },
  {
    step: "03",
    title: "复核输出",
    description: "在任务详情中查看问题清单、进度状态并完成复核。",
  },
];

const riskBadgeVariant = (risk: string) => {
  if (risk === "高") return "destructive";
  if (risk === "中") return "secondary";
  return "outline";
};

const statusTone = (status: string) => {
  if (status === "已完成") return "text-success";
  if (status === "进行中") return "text-primary";
  if (status === "失败") return "text-destructive";
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
    <div className="space-y-8 pb-6">
      <section className="relative overflow-hidden rounded-[32px] border border-sky-100 bg-white px-6 py-8 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] md:px-8">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(240,249,255,0.95),rgba(255,255,255,0.9),rgba(239,246,255,0.85))]" />
        <div className="absolute -left-20 top-0 h-56 w-56 rounded-full bg-sky-100/70 blur-3xl" />
        <div className="absolute -right-16 top-10 h-64 w-64 rounded-full bg-cyan-100/70 blur-3xl" />
        <div className="absolute bottom-0 right-24 h-32 w-32 rounded-full bg-amber-100/60 blur-2xl" />

        <div className="relative grid gap-8 xl:grid-cols-5">
          <div className="space-y-6 xl:col-span-3">
            <Badge
              variant="outline"
              className="rounded-full border-sky-200 bg-sky-50 px-4 py-1 text-sky-700"
            >
              招投标文件智能审查平台
            </Badge>

            <div className="max-w-3xl space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
                审查任务、风险线索与
                <span className="block text-sky-700">正式输出一屏掌握</span>
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                首页聚焦上传发起、任务进展、问题跟踪与结果输出，
                让进入系统后的第一眼先看到当前状态、待办事项和关键结果。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-full px-6 shadow-lg shadow-sky-200/70">
                <Link to="/upload">
                  立即发起审查
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-full border-slate-200 px-6">
                <Link to="/projects">
                  查看项目池
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {capabilityPanels.map((panel) => (
                <div
                  key={panel.title}
                  className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.45)] backdrop-blur-sm transition-transform duration-300 hover:-translate-y-0.5"
                >
                  <div className="mb-3 inline-flex rounded-2xl bg-sky-100 p-3 text-sky-700">
                    <panel.icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-base font-semibold text-slate-900">{panel.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{panel.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] bg-slate-950 p-6 text-slate-50 shadow-[0_30px_80px_-40px_rgba(2,6,23,0.8)] xl:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-sky-200">实时运行概况</p>
                <h2 className="mt-2 text-2xl font-semibold">审查中心总览</h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/10 p-3 text-sky-200">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {isLoading &&
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="h-3 w-20 rounded-full bg-white/10" />
                    <div className="mt-3 h-7 w-16 rounded-full bg-white/10" />
                  </div>
                ))}

              {!isLoading &&
                stats.map((stat) => {
                  const Icon = statIcons[stat.label as keyof typeof statIcons] ?? FolderKanban;

                  return (
                    <div
                      key={stat.label}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-slate-300">{stat.label}</p>
                          <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
                        </div>
                        <div className="rounded-2xl bg-sky-400/10 p-3 text-sky-300">
                          <Icon className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span>{stat.change}</span>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-400/15 p-2.5 text-emerald-200">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-100">首页信息组织方式</p>
                  <p className="mt-1 text-sm leading-6 text-emerald-50/80">
                    强调状态、进度、问题与输出结果，减少分散注意力的装饰元素，提升浏览效率。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading &&
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="rounded-[24px] border-slate-200/80 bg-white/90 shadow-sm">
              <CardContent className="p-6">
                <div className="h-3 w-24 rounded-full bg-slate-100" />
                <div className="mt-4 h-8 w-20 rounded-full bg-slate-100" />
              </CardContent>
            </Card>
          ))}

        {!isLoading &&
          stats.map((stat) => {
            const Icon = statIcons[stat.label as keyof typeof statIcons] ?? FolderKanban;

            return (
              <Card
                key={stat.label}
                className="rounded-[24px] border-slate-200/80 bg-white/95 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.4)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-36px_rgba(14,116,144,0.28)]"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                      <p className="mt-3 text-3xl font-semibold text-slate-900">{stat.value}</p>
                    </div>
                    <div className="rounded-2xl bg-sky-50 p-3 text-sky-700">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className={stat.change.startsWith("+") ? "text-emerald-600" : "text-rose-600"}>
                      {stat.change}
                    </span>
                    <span>较上期</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </section>

      <section className="grid gap-6 xl:grid-cols-12">
        <Card className="rounded-[28px] border-slate-200/80 bg-white shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)] xl:col-span-5">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-slate-900">首页快捷区</CardTitle>
            <CardDescription className="text-sm leading-6 text-slate-500">
              用更明确的入口组织首页，让首次进入的用户快速理解平台怎么用。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.title}
                  to={action.href}
                  className="group rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition-all duration-300 hover:border-sky-200 hover:bg-sky-50"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-white p-3 text-sky-700 shadow-sm">
                      <action.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-slate-900">{action.title}</h3>
                        <ArrowUpRight className="h-4 w-4 text-slate-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-sky-700" />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{action.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">建议使用流程</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">把首页从“看数据”升级成“看状态 + 直接行动”。</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {processSteps.map((item) => (
                  <div
                    key={item.step}
                    className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-4"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sm font-semibold text-sky-700">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-slate-200/80 bg-white shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)] xl:col-span-7">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl text-slate-900">最近审查任务</CardTitle>
                <CardDescription className="mt-1 text-sm leading-6 text-slate-500">
                  保留你原来的任务追踪能力，但层级更清晰、视觉更轻。
                </CardDescription>
              </div>
              <Button asChild variant="outline" className="rounded-full border-slate-200">
                <Link to="/projects">
                  查看全部
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
                仪表盘数据加载失败，请稍后刷新后重试。
              </div>
            )}

            {!isError && !isLoading && recentTasks.length === 0 && (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-sky-700 shadow-sm">
                  <FileSearch className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">还没有审查任务</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  可以直接从首页发起文件审查，系统会把任务、风险和问题清单自动串起来。
                </p>
                <Button asChild className="mt-5 rounded-full px-5">
                  <Link to="/upload">
                    去上传文件
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}

            <div className="space-y-3">
              {recentTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className="w-full rounded-[22px] border border-slate-200 bg-slate-50/70 p-4 text-left transition-all duration-300 hover:border-sky-200 hover:bg-white hover:shadow-[0_18px_50px_-38px_rgba(14,116,144,0.24)]"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-slate-900">{task.name}</h3>
                        <Badge variant={riskBadgeVariant(task.risk)} className="rounded-full">
                          风险 {task.risk}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                        <span className={statusTone(task.status)}>{task.status}</span>
                        <span className="text-slate-300">/</span>
                        <span>AI 审查进度 {task.progress}%</span>
                      </div>
                    </div>

                    <div className="w-full max-w-xs lg:w-64">
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                        <span>处理进度</span>
                        <span>{task.progress}%</span>
                      </div>
                      <Progress value={task.progress} className="h-2.5" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Dashboard;
