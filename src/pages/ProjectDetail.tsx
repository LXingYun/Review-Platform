import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileSearch, FolderKanban, RotateCcw, Trash2, UploadCloud } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DocumentItem, ProjectDetailItem, ReviewTaskItem, ReviewTaskResult } from "@/lib/api-types";

const statusStyle = (status: ProjectDetailItem["status"]) => {
  if (status === "进行中") return "border-stone-900/10 bg-stone-900/5 text-stone-900";
  if (status === "已完成") return "border-success/20 bg-success/10 text-success";
  if (status === "未完成") return "border-warning/20 bg-warning/10 text-warning";
  return "border-stone-200 bg-white/70 text-stone-600";
};

const taskRiskBadge = (risk: ReviewTaskItem["riskLevel"]) => {
  if (risk === "高") return "destructive" as const;
  if (risk === "中") return "secondary" as const;
  return "outline" as const;
};

const parseMethodLabel = (parseMethod: DocumentItem["parseMethod"]) => {
  if (parseMethod === "pdf-text") return "PDF 文本";
  if (parseMethod === "plain-text") return "纯文本";
  if (parseMethod === "image-ocr") return "图片 OCR";
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
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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

  const retryTaskMutation = useMutation({
    mutationFn: (taskId: string) =>
      apiRequest<ReviewTaskResult>(`/review-tasks/${taskId}/retry`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["findings"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const abortTaskMutation = useMutation({
    mutationFn: (taskId: string) =>
      apiRequest<{ success: boolean }>(`/review-tasks/${taskId}/abort`, {
        method: "POST",
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
    <div className="space-y-8 pb-8">
      <section className="surface-paper rounded-[34px] px-6 py-8 md:px-8 md:py-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="rounded-full" asChild>
                <Link to="/projects">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <span className="eyebrow">Project Detail</span>
            </div>
            <div className="space-y-3">
              <h1 className="font-display text-4xl leading-[1.08] text-stone-950 md:text-5xl">{project.name}</h1>
              <p className="max-w-2xl text-base leading-8 text-stone-600">
                这里承接项目维度下的任务记录、文件归档和后续复核入口。你可以把它理解成当前项目的业务上下文总览页。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={statusStyle(project.status)}>
                {project.status}
              </Badge>
              <Badge variant="outline">{project.type}</Badge>
              <Badge variant="outline">创建于 {project.date}</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={deleteProjectMutation.isPending}>
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
                    onClick={() => deleteProjectMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    确认删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button onClick={() => navigate(`/upload?projectId=${encodeURIComponent(project.id)}`)}>
              <UploadCloud className="mr-2 h-4 w-4" />
              新建审查任务
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-stone-200/90 bg-white/78 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Tasks</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">{project.taskCount}</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">项目级任务会在这里继续汇聚成一张可追踪的列表。</p>
          </div>
          <div className="rounded-[24px] border border-stone-200/90 bg-white/78 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Issues</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">{project.issueCount}</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">问题数量会跟随任务执行结果实时变化，帮助你判断是否需要继续推进。</p>
          </div>
          <div className="rounded-[24px] border border-stone-200/90 bg-white/78 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Documents</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">{documents.length}</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">文件页数、摘要和解析方式会在项目层汇总呈现。</p>
          </div>
        </div>
      </section>

      <Card className="surface-panel bg-white/72">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg text-stone-950">项目概览</CardTitle>
          <CardDescription>项目说明会直接影响后续判断语境，因此保持描述清晰很重要。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[24px] border border-stone-200/90 bg-white/82 p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-stone-200 bg-stone-50 text-stone-800">
                <FolderKanban className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-stone-950">{project.type}</h2>
                <p className="mt-3 text-sm leading-7 text-stone-600">{project.description || "暂无项目描述"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,242,233,0.88))]">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-[28px] text-stone-950">审查任务</CardTitle>
            <CardDescription>项目内的每一轮审查，都会在这里留下执行状态、风险级别和进入详情的入口。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasksLoading && <p className="text-sm text-muted-foreground">任务加载中...</p>}
            {!tasksLoading && tasks.length === 0 && <p className="text-sm text-muted-foreground">当前项目还没有审查任务。</p>}
            {tasks.map((task) => (
              <div key={task.id} className="rounded-[24px] border border-stone-200/90 bg-white/82 p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-stone-950">{task.name}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {task.scenario === "tender_compliance" ? "招标审查" : "投标审查"} · {task.createdAt.slice(0, 10)}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-stone-600">当前阶段：{task.stageLabel}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Badge variant="outline">{task.status}</Badge>
                      <Badge variant={taskRiskBadge(task.riskLevel)}>{task.riskLevel}风险</Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(task.status === "待审核" || task.status === "进行中") && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" disabled={abortTaskMutation.isPending}>
                            中止任务
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>中止当前任务？</AlertDialogTitle>
                            <AlertDialogDescription>
                              中止后任务会标记为未完成，当前审查结果不会保留，你可以稍后重新执行。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={() => abortTaskMutation.mutate(task.id)}>确认中止</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {(task.status === "失败" || task.status === "未完成") && (
                      <Button size="sm" variant="outline" disabled={retryTaskMutation.isPending} onClick={() => retryTaskMutation.mutate(task.id)}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        重新执行
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" disabled={deleteTaskMutation.isPending}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除任务
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>删除审查任务？</AlertDialogTitle>
                          <AlertDialogDescription>
                            删除后会同时移除该任务产生的问题结果，但不会删除原始上传文件。
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

                    <Button size="sm" variant="outline" onClick={() => navigate(`/tasks/${task.id}`)}>
                      <FileSearch className="mr-2 h-4 w-4" />
                      查看任务
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,242,233,0.88))]">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-[28px] text-stone-950">文件清单</CardTitle>
            <CardDescription>文件保持后台业务密度，但视觉上收敛成更安静的归档列表。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {documentsLoading && <p className="text-sm text-muted-foreground">文件加载中...</p>}
            {!documentsLoading && documents.length === 0 && <p className="text-sm text-muted-foreground">当前项目还没有上传文件。</p>}
            {documents.map((document) => (
              <div key={document.id} className="rounded-[24px] border border-stone-200/90 bg-white/82 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-stone-950">{document.originalName}</p>
                    <p className="mt-2 text-xs text-stone-500">
                      {document.role} · {document.pageCount} 页 · {parseMethodLabel(document.parseMethod)}
                    </p>
                  </div>
                  <Badge variant="outline">{document.parseStatus}</Badge>
                </div>
                <p className="mt-4 rounded-[18px] border border-stone-200/80 bg-stone-50/85 p-4 text-sm leading-7 text-stone-600">
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
