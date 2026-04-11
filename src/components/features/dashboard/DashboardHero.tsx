import { ArrowRight, ArrowUpRight, Scale, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const overviewNotes = [
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

const DashboardHero = () => (
  <section className="surface-paper relative overflow-hidden rounded-[36px] px-6 py-8 md:px-10 md:py-10">
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[radial-gradient(circle,hsla(var(--accent),0.14),transparent_68%)]" />
    <div className="absolute left-0 top-20 h-48 w-48 rounded-full bg-[radial-gradient(circle,hsla(0,0%,100%,0.46),transparent_70%)]" />

    <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px] xl:items-stretch">
      <div className="space-y-7">
        <div className="space-y-4">
          <span className="eyebrow">AI 审查工作台</span>
          <div className="max-w-4xl space-y-4">
            <h1 className="font-display text-4xl leading-[1.05] text-foreground md:text-6xl">
              把招投标审查
              <span className="block text-[hsl(var(--accent))]">变成一条连续、可复核的工作流</span>
            </h1>
            <p className="max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
              这里不是传统的数据大盘，而是一张更安静的工作台首页。上传资料、推进任务、查看风险，再回到人工复核，
              每一步都在同一个语境里完成。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-12 rounded-full px-6 shadow-[0_18px_34px_-22px_rgba(24,24,27,0.36)]">
            <Link to="/upload">
              立即发起审查
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 rounded-full px-6">
            <Link to="/projects">
              查看项目池
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 xl:auto-rows-fr">
        {overviewNotes.map((note) => (
          <div key={note.title} className="flex h-full flex-col rounded-[24px] border border-border/80 bg-background/72 p-4">
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-full border border-border/80 bg-background/88 p-2.5 text-primary">
                <note.icon className="h-4 w-4" />
              </div>
              <h2 className="text-base font-semibold text-foreground">{note.title}</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{note.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default DashboardHero;
