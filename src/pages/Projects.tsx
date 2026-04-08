import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, FolderKanban, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { apiRequest } from "@/lib/api";
import { ProjectListItem } from "@/lib/api-types";

const statusStyle = (status: ProjectListItem["status"]) => {
  if (status === "进行中") return "bg-primary/10 text-primary border-primary/20";
  if (status === "已完成") return "bg-success/10 text-success border-success/20";
  if (status === "未完成") return "bg-warning/10 text-warning border-warning/20";
  return "bg-muted text-muted-foreground border-border";
};

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">项目管理</h1>
          <p className="mt-1 text-muted-foreground">管理审查项目、任务和问题数量</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
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
                  <SelectTrigger className="mt-1">
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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="搜索项目..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">项目加载中...</p>}
      {isError && <p className="text-sm text-destructive">项目数据加载失败</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id} className="border border-border shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <FolderKanban className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{project.name}</h3>
                    <p className="text-xs text-muted-foreground">{project.type}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <Badge variant="outline" className={statusStyle(project.status)}>
                  {project.status}
                </Badge>
                <span className="text-xs text-muted-foreground">{project.date}</span>
              </div>

              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span>任务: {project.taskCount}</span>
                <span>问题: {project.issueCount}</span>
              </div>

              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/projects/${project.id}`)}>
                  查看详情
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="px-3"
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
