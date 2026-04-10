import { FolderKanban, Trash2 } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import type { ProjectListItem } from "@/lib/api-types";
import { getProjectStatusClassName } from "@/lib/formatters/project";

interface ProjectCardProps {
  project: ProjectListItem;
  isDeleting: boolean;
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}

const projectTypeNote = (type: ProjectListItem["type"]) =>
  type === "招标审查" ? "聚焦法规、条款与合规要求审查。" : "聚焦响应性、一致性与缺漏风险校验。";

const ProjectCard = ({ project, isDeleting, onOpenProject, onDeleteProject }: ProjectCardProps) => (
  <Card className="surface-panel overflow-hidden border-border/80 bg-card/90 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_28px_-24px_rgba(24,24,27,0.18)]">
    <CardContent className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-border/80 bg-background/80 text-primary">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-foreground">{project.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{project.type}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{projectTypeNote(project.type)}</p>
          </div>
        </div>
        <Badge variant="outline" className={`${getProjectStatusClassName(project.status)} whitespace-nowrap shrink-0`}>
          {project.status}
        </Badge>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Badge variant="outline">{project.date}</Badge>
        <Badge variant="outline">任务 {project.taskCount}</Badge>
        <Badge variant="outline">问题 {project.issueCount}</Badge>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
        <div className="rounded-[18px] border border-border/80 bg-background/70 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">任务数</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{project.taskCount}</p>
        </div>
        <div className="rounded-[18px] border border-border/80 bg-background/70 p-3">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">问题数</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{project.issueCount}</p>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => onOpenProject(project.id)}>
          查看详情
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={(event) => event.stopPropagation()}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除项目？</AlertDialogTitle>
              <AlertDialogDescription>
                这会删除项目、任务、问题记录以及关联的上传文件，且无法恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDeleteProject(project.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </CardContent>
  </Card>
);

export default ProjectCard;
