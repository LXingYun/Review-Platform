import { Link } from "react-router-dom";
import { ArrowLeft, Trash2, UploadCloud } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProjectDetailItem } from "@/lib/api-types";
import { getProjectStatusClassName } from "@/lib/formatters/project";

interface ProjectDetailHeroProps {
  project: ProjectDetailItem;
  documentsCount: number;
  isDeletingProject: boolean;
  onDeleteProject: () => void;
  onCreateTask: () => void;
}

const ProjectDetailHero = ({
  project,
  documentsCount,
  isDeletingProject,
  onDeleteProject,
  onCreateTask,
}: ProjectDetailHeroProps) => (
  <section className="surface-paper rounded-[34px] px-6 py-8 md:px-8 md:py-9">
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" asChild>
            <Link to="/projects">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <span className="eyebrow">项目详情</span>
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-4xl leading-[1.08] text-foreground md:text-5xl">{project.name}</h1>
          <p className="max-w-2xl text-base leading-8 text-muted-foreground">
            {project.description || "暂无项目描述"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={`${getProjectStatusClassName(project.status)} whitespace-nowrap`}>
            {project.status}
          </Badge>
          <Badge variant="outline">{project.type}</Badge>
          <Badge variant="outline">创建于 {project.date}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={isDeletingProject}>
              <Trash2 className="mr-2 h-4 w-4" />
              删除项目
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除项目？</AlertDialogTitle>
              <AlertDialogDescription>
                删除后会同时移除项目下的任务、问题结果和上传文件，且无法恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDeleteProject}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button onClick={onCreateTask}>
          <UploadCloud className="mr-2 h-4 w-4" />
          新建审查任务
        </Button>
      </div>
    </div>

    <div className="mt-8 grid gap-4 md:grid-cols-3">
      <div className="rounded-[24px] border border-border/80 bg-background/74 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">任务数</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{project.taskCount}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">当前项目下发起的所有审查任务及其执行状态。</p>
      </div>
      <div className="rounded-[24px] border border-border/80 bg-background/74 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">问题数</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{project.issueCount}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">AI 审查发现的潜在风险或不合规问题总计。</p>
      </div>
      <div className="rounded-[24px] border border-border/80 bg-background/74 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">文档数</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{documentsCount}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">该项目下已上传的所有招投标文件及支持性附件。</p>
      </div>
    </div>
  </section>
);

export default ProjectDetailHero;
