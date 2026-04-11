import { AlertTriangle, CheckCircle2, Clock3, FolderKanban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardResponse } from "@/lib/api-types";

const statIcons = {
  审查项目总数: FolderKanban,
  待处理任务: Clock3,
  发现问题: AlertTriangle,
  已完成审查: CheckCircle2,
} as const;

interface DashboardStatsProps {
  isLoading: boolean;
  stats: DashboardResponse["stats"];
}

const DashboardStats = ({ isLoading, stats }: DashboardStatsProps) => (
  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    {isLoading &&
      Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="surface-panel border-border/80 bg-card/85">
          <CardContent className="p-5">
            <div className="h-3 w-20 rounded-full bg-muted" />
            <div className="mt-4 h-8 w-16 rounded-full bg-muted" />
          </CardContent>
        </Card>
      ))}

    {!isLoading &&
      stats.map((stat) => {
        const Icon = statIcons[stat.label as keyof typeof statIcons] ?? FolderKanban;

        return (
          <Card key={stat.label} className="surface-panel border-border/80 bg-card/85">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{stat.value}</p>
                </div>
                <div className="rounded-full border border-border/80 bg-background p-3 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
  </section>
);

export default DashboardStats;
