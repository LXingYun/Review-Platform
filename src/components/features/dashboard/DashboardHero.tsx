import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import DashboardUsageGuide from "./DashboardUsageGuide";

const DashboardHero = () => (
  <section className="surface-paper relative overflow-hidden rounded-[36px] px-6 py-8 md:px-10 md:py-10">
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[radial-gradient(circle,hsla(var(--accent),0.14),transparent_68%)]" />
    <div className="absolute left-0 top-20 h-48 w-48 rounded-full bg-[radial-gradient(circle,hsla(0,0%,100%,0.46),transparent_70%)]" />

    <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_560px] xl:items-stretch">
      <div className="space-y-7">
        <div className="space-y-4">
          <span className="eyebrow">AI 审查工作台</span>
          <div className="max-w-4xl space-y-4">
            <h1 className="font-display text-4xl leading-[1.05] text-foreground md:text-6xl">
              将招投标审查，
              <span className="block text-[hsl(var(--accent))]">变成高效、连续的工作流</span>
            </h1>
            <p className="max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
              一站式完成招投标文件审查。从资料上传、AI 智能初审到人工复核，在这里轻松掌控每个项目的进度与风险。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" size="lg" className="h-12 rounded-full px-6">
            <Link to="/projects">
              查看项目池
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <DashboardUsageGuide />
    </div>
  </section>
);

export default DashboardHero;
