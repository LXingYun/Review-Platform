import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileSearch, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { API_BASE_URL, apiRequest } from "@/lib/api";
import { DocumentItem, FindingListItem, ReviewTaskDetailItem } from "@/lib/api-types";

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

const TaskDetail = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { taskId = "" } = useParams();

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["review-tasks", "all"],
    queryFn: () => apiRequest<ReviewTaskDetailItem[]>("/review-tasks"),
    refetchInterval: 3000,
  });

  const task = useMemo(() => tasks.find((item) => item.id === taskId), [tasks, taskId]);

  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["documents", task?.projectId, "task-detail"],
    queryFn: () => apiRequest<DocumentItem[]>(`/documents?projectId=${encodeURIComponent(task!.projectId)}`),
    enabled: Boolean(task?.projectId),
  });

  const { data: findings = [], isLoading: findingsLoading } = useQuery({
    queryKey: ["findings", taskId, "task-detail"],
    queryFn: async () => {
      const projectFindings = await apiRequest<FindingListItem[]>(
        `/findings?projectId=${encodeURIComponent(task!.projectId)}&scenario=${task!.scenario}`,
      );
      return projectFindings.filter((finding) => finding.taskId === taskId);
    },
    enabled: Boolean(task?.projectId && task?.scenario),
    refetchInterval: task && task.status !== "已完成" ? 3000 : false,
  });

  const relatedDocuments = useMemo(() => {
    if (!task) return [];
    return documents.filter((document) => task.documentIds.includes(document.id));
  }, [documents, task]);

  const crossSectionFindings = useMemo(
    () => findings.filter((finding) => finding.reviewStage === "cross_section_review"),
    [findings],
  );

  const deleteTaskMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ success: boolean; taskId: string; projectId: string }>(`/review-tasks/${taskId}`, {
        method: "DELETE",
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["review-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["findings"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate(`/projects/${result.projectId}`);
    },
  });

  if (tasksLoading) {
    return <p className="text-sm text-muted-foreground">任务详情加载中...</p>;
  }

  if (!task) {
    return <p className="text-sm text-destructive">未找到该任务。</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/projects/${task.projectId}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{task.name}</h1>
            <p className="text-muted-foreground mt-1">任务详情、关联文件与问题结果</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={deleteTaskMutation.isPending}>
                <Trash2 className="h-4 w-4 mr-2" />
                删除任务
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>删除审查任务？</AlertDialogTitle>
                <AlertDialogDescription>
                  删除后会同步移除该任务对应的问题结果，但不会删除原始上传文件。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteTaskMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  确认删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={() => navigate(`/results?projectId=${encodeURIComponent(task.projectId)}&scenario=${task.scenario}&taskId=${task.id}`)}>
            <FileSearch className="h-4 w-4 mr-2" />
            查看结果页
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(`${API_BASE_URL}/review-tasks/${task.id}/formal-report`, "_blank", "noopener,noreferrer")}
            disabled={!task.formalReportHtml}
          >
            查看报告
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border border-border shadow-sm lg:col-span-2">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{task.projectName}</Badge>
              <Badge variant="outline">{task.scenario === "tender_compliance" ? "招标审查" : "投标审查"}</Badge>
              <Badge variant={riskBadge(task.riskLevel)}>{task.riskLevel}风险</Badge>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>任务状态：{task.status}</p>
              <p>当前阶段：{task.stageLabel}</p>
              <p>创建时间：{task.createdAt.slice(0, 10)}</p>
              <p>完成时间：{task.completedAt ? task.completedAt.slice(0, 10) : "未完成"}</p>
              <p>进度：{task.progress}%</p>
            </div>
            <div className="pt-2">
              <Progress value={task.progress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">统计</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">关联文件</span>
              <span className="font-medium">{relatedDocuments.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">问题数量</span>
              <span className="font-medium">{findings.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">关联文件</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {documentsLoading && <p className="text-sm text-muted-foreground">文件加载中...</p>}
            {!documentsLoading && relatedDocuments.length === 0 && <p className="text-sm text-muted-foreground">当前任务没有关联文件。</p>}
            {relatedDocuments.map((document) => (
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

        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">问题摘要</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {findingsLoading && <p className="text-sm text-muted-foreground">问题加载中...</p>}
            {!findingsLoading && findings.length === 0 && <p className="text-sm text-muted-foreground">当前任务暂无问题结果。</p>}
            {findings.map((finding) => (
              <div key={finding.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{finding.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{finding.location}</p>
                  </div>
                  <Badge variant={riskBadge(finding.risk)}>{finding.risk}风险</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-3">{finding.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">章节审查摘要</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {task.chapterSummaries.length === 0 && <p className="text-sm text-muted-foreground">当前任务暂无章节摘要。</p>}
          {task.chapterSummaries.length > 0 && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">识别出的章节清单</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {task.chapterSummaries.map((chapter) => (
                  <Badge key={`chapter-list-${chapter.title}`} variant="outline">
                    {chapter.title} · {chapter.pageRange}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {task.chapterSummaries.map((chapter) => (
            <div key={chapter.title} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{chapter.title}</p>
                <Badge variant="outline">{chapter.issueCount} 个问题</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{chapter.pageRange}</p>
              <p className="text-sm text-muted-foreground mt-2">{chapter.summary || "暂无章节摘要"}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">跨章节冲突摘要</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {crossSectionFindings.length === 0 && <p className="text-sm text-muted-foreground">当前任务暂无跨章节冲突。</p>}
          {crossSectionFindings.map((finding) => (
            <div key={finding.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{finding.title}</p>
                <Badge variant={riskBadge(finding.risk)}>{finding.risk}风险</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{finding.location}</p>
              <p className="text-sm text-muted-foreground mt-2">{finding.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskDetail;
