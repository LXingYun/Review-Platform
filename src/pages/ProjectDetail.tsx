import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileSearch, FolderKanban, Trash2, UploadCloud } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { apiRequest } from "@/lib/api";
import { DocumentItem, ProjectDetailItem, ReviewTaskItem } from "@/lib/api-types";

const statusStyle = (status: string) => {
  if (status === "进行中") return "bg-primary/10 text-primary border-primary/20";
  if (status === "已完成") return "bg-success/10 text-success border-success/20";
  return "bg-muted text-muted-foreground border-border";
};

const riskBadge = (risk: string) => {
  if (risk === "高") return "destructive" as const;
  if (risk === "中") return "secondary" as const;
  return "outline" as const;
};

const parseMethodLabel = (parseMethod: DocumentItem["parseMethod"]) => {
  if (parseMethod === "pdf-text") return "PDF文本";
  if (parseMethod === "plain-text") return "纯文本";
  if (parseMethod === "image-ocr") return "图片OCR";
  return "占位解析";
};

const ProjectDetail = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { projectId = "" } = useParams();

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["projects", "detail"],
    queryFn: () => apiRequest<ProjectDetailItem[]>("/projects"),
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["review-tasks", projectId],
    queryFn: () => apiRequest<ReviewTaskItem[]>(`/review-tasks?projectId=${encodeURIComponent(projectId)}`),
    enabled: Boolean(projectId),
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["documents", projectId, "detail"],
    queryFn: () => apiRequest<DocumentItem[]>(`/documents?projectId=${encodeURIComponent(projectId)}`),
    enabled: Boolean(projectId),
  });

  const project = useMemo(() => projects.find((item) => item.id === projectId), [projects, projectId]);

  const deleteProjectMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ success: boolean; projectId: string }>(`/projects/${projectId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate("/projects");
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) =>
      apiRequest<{ success: boolean; taskId: string; projectId: string }>(`/review-tasks/${taskId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["findings"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  if (projectsLoading) {
    return <p className="text-sm text-muted-foreground">项目详情加载中...</p>;
  }

  if (!project) {
    return <p className="text-sm text-destructive">未找到该项目。</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/projects">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
            <p className="text-muted-foreground mt-1">项目详情、任务记录与文件清单</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={deleteProjectMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                删除项目
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>删除项目？</AlertDialogTitle>
                <AlertDialogDescription>
                  删除后会同时移除项目下的任务、问题结果和已上传文件，且无法恢复。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteProjectMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  确认删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={() => navigate(`/upload?projectId=${encodeURIComponent(project.id)}`)}>
            <UploadCloud className="h-4 w-4 mr-2" />
            新建审查任务
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border border-border shadow-sm lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FolderKanban className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">项目概览</h2>
                <p className="text-sm text-muted-foreground">{project.type}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Badge variant="outline" className={statusStyle(project.status)}>
                {project.status}
              </Badge>
              <Badge variant="outline">创建于 {project.date}</Badge>
            </div>
            <p className="mt-4 text-sm text-muted-foreground rounded-lg bg-muted p-3">
              {project.description || "暂无项目描述"}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">统计</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">任务数</span>
              <span className="font-medium">{project.taskCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">问题数</span>
              <span className="font-medium">{project.issueCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">文件数</span>
              <span className="font-medium">{documents.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">审查任务</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasksLoading && <p className="text-sm text-muted-foreground">任务加载中...</p>}
            {!tasksLoading && tasks.length === 0 && <p className="text-sm text-muted-foreground">当前项目还没有审查任务。</p>}
            {tasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{task.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {task.scenario === "tender_compliance" ? "招标审查" : "投标审查"} · {task.createdAt.slice(0, 10)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{task.status}</Badge>
                    <Badge variant={riskBadge(task.riskLevel)}>{task.riskLevel}风险</Badge>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <div className="flex gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" disabled={deleteTaskMutation.isPending}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除任务
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>删除审查任务？</AlertDialogTitle>
                          <AlertDialogDescription>
                            删除后会同步移除该任务产生的问题结果，但不会删除原始上传文件。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteTaskMutation.mutate(task.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            确认删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/tasks/${task.id}`)}
                    >
                      <FileSearch className="h-4 w-4 mr-2" />
                      查看任务
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">文件清单</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {documentsLoading && <p className="text-sm text-muted-foreground">文件加载中...</p>}
            {!documentsLoading && documents.length === 0 && <p className="text-sm text-muted-foreground">当前项目还没有上传文件。</p>}
            {documents.map((document) => (
              <div key={document.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{document.originalName}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {document.role} · {document.pageCount} 页 · {parseMethodLabel(document.parseMethod)}
                    </p>
                  </div>
                  <Badge variant="outline">{document.parseStatus}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-3 rounded-lg bg-muted p-3">
                  {document.textPreview || "暂无解析摘要"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProjectDetail;
