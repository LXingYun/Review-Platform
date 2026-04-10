import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Plus, Search, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectListItem } from "@/lib/api-types";
import { useCreateProjectMutation, useDeleteProjectMutation, useProjectsQuery } from "@/hooks/queries";

const statusStyle = (status: ProjectListItem["status"]) => {
  if (status === "进行中") return "border-primary/20 bg-primary/10 text-primary";
  if (status === "已完成") return "border-success/20 bg-success/10 text-success";
  if (status === "未完成") return "border-warning/20 bg-warning/10 text-warning";
  return "border-border bg-background/80 text-muted-foreground";
};

const projectTypeNote = (type: ProjectListItem["type"]) =>
  type === "招标审查" ? "聚焦法规、条款与合规要求审查。" : "聚焦响应性、一致性与缺漏风险核验。";

const Projects = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"招标审查" | "投标审查" | "">("");
  const [description, setDescription] = useState("");

  const { data: projects = [], isLoading, isError } = useProjectsQuery(search);

const createProjectMutation = useCreateProjectMutation({
    onSuccess: () => {
      setOpen(false);
      setName("");
      setType("");
      setDescription("");
    },
  });

  const deleteProjectMutation = useDeleteProjectMutation();

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索项目..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11" />
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="rounded-full px-6">
              <Plus className="mr-2 h-4 w-4" />
              新建项目
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建审查项目</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>项目名称</Label>
                <Input placeholder="输入项目名称" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>审查类型</Label>
                <Select value={type} onValueChange={(value) => setType(value as "招标审查" | "投标审查")}>
                  <SelectTrigger className="mt-1 rounded-[18px]">
                    <SelectValue placeholder="选择类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="招标审查">招标审查</SelectItem>
                    <SelectItem value="投标审查">投标审查</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>项目描述</Label>
                <Textarea
                  placeholder="输入项目描述"
                  className="mt-1"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={!name || !type || createProjectMutation.isPending}
                onClick={() => {
                  if (!type) return;
                  createProjectMutation.mutate({ name, type, description });
                }}
              >
                {createProjectMutation.isPending ? "创建中..." : "创建项目"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">项目加载中...</p>}
      {isError && <p className="text-sm text-destructive">项目数据加载失败</p>}

      {!isLoading && !isError && projects.length === 0 && (
        <p className="py-8 text-sm text-muted-foreground">还没有项目，点击右上角“新建项目”开始。</p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {projects.map((project) => (
          <Card
            key={project.id}
            className="surface-panel overflow-hidden border-border/80 bg-card/90 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_28px_-24px_rgba(24,24,27,0.18)]"
          >
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
                <Badge variant="outline" className={`${statusStyle(project.status)} whitespace-nowrap shrink-0`}>
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
                <Button variant="outline" className="flex-1" onClick={() => navigate(`/projects/${project.id}`)}>
                  查看详情
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 shrink-0"
                      onClick={(event) => event.stopPropagation()}
                      disabled={deleteProjectMutation.isPending}
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
                        onClick={() => deleteProjectMutation.mutate(project.id)}
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
        ))}
      </div>
    </div>
  );
};

export default Projects;
