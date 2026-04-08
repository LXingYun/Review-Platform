import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Plus, Search, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { apiRequest } from "@/lib/api";
import { ProjectListItem } from "@/lib/api-types";

const statusStyle = (status: ProjectListItem["status"]) => {
  if (status === "进行中") return "border-stone-900/10 bg-stone-900/5 text-stone-900";
  if (status === "已完成") return "border-success/20 bg-success/10 text-success";
  if (status === "未完成") return "border-warning/20 bg-warning/10 text-warning";
  return "border-stone-200 bg-white/70 text-stone-600";
};

const projectTypeNote = (type: ProjectListItem["type"]) =>
  type === "招标审查" ? "偏向规则、条款和合规性判断" : "偏向响应性、一致性和缺漏核验";

const Projects = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"招标审查" | "投标审查" | "">("");
  const [description, setDescription] = useState("");

  const { data: projects = [], isLoading, isError } = useQuery({
    queryKey: ["projects", search],
    queryFn: () => apiRequest<ProjectListItem[]>(`/projects?search=${encodeURIComponent(search)}`),
  });

  const createProjectMutation = useMutation({
    mutationFn: (payload: { name: string; type: "招标审查" | "投标审查"; description: string }) =>
      apiRequest<ProjectListItem>("/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setOpen(false);
      setName("");
      setType("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: string) =>
      apiRequest<{ success: boolean; projectId: string }>(`/projects/${projectId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <div className="space-y-8 pb-8">
      <section className="surface-paper rounded-[34px] px-6 py-8 md:px-8 md:py-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <span className="eyebrow">Project Workspace</span>
            <div className="space-y-3">
              <h1 className="font-display text-4xl leading-[1.08] text-stone-950 md:text-5xl">所有审查项目，都在这里形成一张持续推进的项目池</h1>
              <p className="max-w-2xl text-base leading-8 text-stone-600">
                项目页不只是存档列表，它同时承担状态追踪、问题计数和入口分流。每个项目都会继续通向任务、文件与复核动作。
              </p>
            </div>
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
                    <SelectTrigger className="mt-1 rounded-[18px] border-stone-300 bg-white/75">
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
                  <Textarea placeholder="输入项目描述" className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
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

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-stone-200/90 bg-white/78 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Projects</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">{projects.length}</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">项目是所有资料、任务和问题流转的上层容器。</p>
          </div>
          <div className="rounded-[24px] border border-stone-200/90 bg-white/78 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">States</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">{projects.filter((project) => project.status === "进行中").length}</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">进行中的项目会成为你后续进入任务详情的主要入口。</p>
          </div>
          <div className="rounded-[24px] border border-stone-200/90 bg-white/78 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Search</p>
            <p className="mt-3 text-sm leading-7 text-stone-600">用搜索快速定位某个项目，再进入它的文件、任务和问题清单。</p>
          </div>
        </div>
      </section>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="搜索项目..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11" />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">项目加载中...</p>}
      {isError && <p className="text-sm text-destructive">项目数据加载失败</p>}

      {!isLoading && !isError && projects.length === 0 && (
        <Card className="surface-panel bg-white/72">
          <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-800">
              <FolderKanban className="h-6 w-6" />
            </div>
            <h2 className="font-display text-3xl text-stone-950">还没有项目</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">先创建一个项目，再把文件、任务和复核动作挂到同一条审查上下文里。</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id} className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,242,233,0.88))] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_28px_-24px_rgba(28,25,23,0.45)]">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-stone-200 bg-white/90 text-stone-800">
                    <FolderKanban className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-stone-950">{project.name}</h3>
                    <p className="mt-1 text-sm text-stone-500">{project.type}</p>
                    <p className="mt-2 text-sm leading-6 text-stone-600">{projectTypeNote(project.type)}</p>
                  </div>
                </div>
                <Badge variant="outline" className={statusStyle(project.status)}>
                  {project.status}
                </Badge>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{project.date}</Badge>
                <Badge variant="outline">任务 {project.taskCount}</Badge>
                <Badge variant="outline">问题 {project.issueCount}</Badge>
              </div>

              <div className="mt-5 grid gap-3 text-sm text-stone-600 md:grid-cols-2">
                <div className="rounded-[18px] border border-stone-200/90 bg-white/75 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Task count</p>
                  <p className="mt-2 text-2xl font-semibold text-stone-950">{project.taskCount}</p>
                </div>
                <div className="rounded-[18px] border border-stone-200/90 bg-white/75 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Issue count</p>
                  <p className="mt-2 text-2xl font-semibold text-stone-950">{project.issueCount}</p>
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
