import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  MessageSquarePlus,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { DocumentItem, FindingListItem, ReviewTaskDetailItem, ReviewTaskResult } from "@/lib/api-types";

const reviewerStorageKey = "review-platform-reviewer";

const riskBadge = (risk: string) => {
  if (risk === "高") return "destructive" as const;
  if (risk === "中") return "secondary" as const;
  return "outline" as const;
};

const riskIcon = (risk: string) => {
  if (risk === "高") return <XCircle className="h-5 w-5 text-destructive" />;
  if (risk === "中") return <AlertTriangle className="h-5 w-5 text-warning" />;
  return <CheckCircle2 className="h-5 w-5 text-success" />;
};

const reviewStageLabel = (stage: FindingListItem["reviewStage"]) => {
  if (stage === "cross_section_review") return "跨章节冲突";
  if (stage === "response_consistency_review") return "响应一致性";
  return "章节审查";
};

const parseMethodLabel = (parseMethod: DocumentItem["parseMethod"]) => {
  if (parseMethod === "pdf-text") return "PDF 文本";
  if (parseMethod === "plain-text") return "纯文本";
  if (parseMethod === "image-ocr") return "图片 OCR";
  return "占位解析";
};

const ChunkGroup = ({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; text: string }>;
}) => {
  if (items.length === 0) return null;

  return (
    <div>
      <Label className="text-xs text-muted-foreground">{title}</Label>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div key={`${title}-${item.label}-${item.text}`} className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-sm text-foreground">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const formatReviewAction = (action: FindingListItem["reviewLogs"][number]["action"]) => {
  if (action === "confirm") return "确认问题";
  if (action === "ignore") return "忽略问题";
  return "添加备注";
};

const TaskDetail = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { taskId = "" } = useParams();
  const [search, setSearch] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<FindingListItem | null>(null);
  const [humanReviewFilter, setHumanReviewFilter] = useState<"all" | "needs_review" | "no_review">("all");
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | "ge_80" | "ge_60" | "lt_60">("all");
  const [reviewer, setReviewer] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setReviewer(window.localStorage.getItem(reviewerStorageKey) ?? "");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (reviewer) {
      window.localStorage.setItem(reviewerStorageKey, reviewer);
    }
  }, [reviewer]);

  useEffect(() => {
    setReviewNote("");
  }, [selectedIssue?.id]);

  useEffect(() => {
    if (!selectedIssue) return;

    const nextSelectedIssue = findings.find((finding) => finding.id === selectedIssue.id);
    if (!nextSelectedIssue) {
      setSelectedIssue(null);
      return;
    }

    if (nextSelectedIssue !== selectedIssue) {
      setSelectedIssue(nextSelectedIssue);
    }
  }, [findings, selectedIssue]);

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
    refetchInterval: task && (task.status === "待审核" || task.status === "进行中") ? 3000 : false,
  });

  const relatedDocuments = useMemo(() => {
    if (!task) return [];
    return documents.filter((document) => task.documentIds.includes(document.id));
  }, [documents, task]);

  const filteredFindings = useMemo(() => {
    return findings.filter((finding) => {
      if (search.trim()) {
        const keyword = search.trim();
        const matched =
          finding.title.includes(keyword) ||
          finding.description.includes(keyword) ||
          finding.location.includes(keyword) ||
          finding.category.includes(keyword);

        if (!matched) return false;
      }

      if (humanReviewFilter === "needs_review" && !finding.needsHumanReview) return false;
      if (humanReviewFilter === "no_review" && finding.needsHumanReview) return false;

      if (confidenceFilter === "ge_80" && finding.confidence < 0.8) return false;
      if (confidenceFilter === "ge_60" && finding.confidence < 0.6) return false;
      if (confidenceFilter === "lt_60" && finding.confidence >= 0.6) return false;

      return true;
    });
  }, [confidenceFilter, findings, humanReviewFilter, search]);

  const highCount = filteredFindings.filter((finding) => finding.risk === "高").length;
  const midCount = filteredFindings.filter((finding) => finding.risk === "中").length;
  const lowCount = filteredFindings.filter((finding) => finding.risk === "低").length;

  const updateFindingMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "待复核" | "已确认" | "已忽略" }) =>
      apiRequest<FindingListItem>(`/findings/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          note: reviewNote.trim() || undefined,
          reviewer: reviewNote.trim() ? reviewer.trim() : undefined,
        }),
      }),
    onSuccess: () => {
      setSelectedIssue(null);
      setReviewNote("");
      queryClient.invalidateQueries({ queryKey: ["findings"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const addReviewLogMutation = useMutation({
    mutationFn: ({ id, note, reviewerName }: { id: string; note: string; reviewerName: string }) =>
      apiRequest<FindingListItem>(`/findings/${id}/review-log`, {
        method: "POST",
        body: JSON.stringify({
          note,
          reviewer: reviewerName,
        }),
      }),
    onSuccess: (updatedFinding) => {
      setSelectedIssue(updatedFinding);
      setReviewNote("");
      queryClient.invalidateQueries({ queryKey: ["findings"] });
    },
  });

  const retryTaskMutation = useMutation({
    mutationFn: () =>
      apiRequest<ReviewTaskResult>(`/review-tasks/${taskId}/retry`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["findings"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const abortTaskMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ success: boolean }>(`/review-tasks/${taskId}/abort`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["findings"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

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

  const submitNote = () => {
    if (!selectedIssue || !reviewNote.trim() || !reviewer.trim()) return;

    addReviewLogMutation.mutate({
      id: selectedIssue.id,
      note: reviewNote.trim(),
      reviewerName: reviewer.trim(),
    });
  };

  const renderIssueRow = (finding: FindingListItem) => (
    <div
      key={finding.id}
      className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-muted/50"
      onClick={() => setSelectedIssue(finding)}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex w-8 shrink-0 items-center justify-center self-stretch">{riskIcon(finding.risk)}</div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{finding.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{finding.location}</p>
        </div>
      </div>
      <div className="ml-4 flex items-center gap-2">
        <Badge variant="outline">{reviewStageLabel(finding.reviewStage)}</Badge>
        <Badge variant={riskBadge(finding.risk)}>{finding.risk}风险</Badge>
        {finding.needsHumanReview && <Badge variant="outline">需复核</Badge>}
        <Badge variant="outline" className="text-xs">
          {finding.status}
        </Badge>
      </div>
    </div>
  );

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
            <p className="mt-1 text-muted-foreground">任务详情、关联文件与问题清单</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(task.status === "待审核" || task.status === "进行中") && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={abortTaskMutation.isPending}>
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
                  <AlertDialogAction onClick={() => abortTaskMutation.mutate()}>确认中止</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {(task.status === "失败" || task.status === "未完成") && (
            <Button variant="outline" disabled={retryTaskMutation.isPending} onClick={() => retryTaskMutation.mutate()}>
              <RotateCcw className="mr-2 h-4 w-4" />
              重新执行
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={deleteTaskMutation.isPending}>
                <Trash2 className="mr-2 h-4 w-4" />
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
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border border-border shadow-sm lg:col-span-2">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{task.projectName}</Badge>
              <Badge variant="outline">{task.scenario === "tender_compliance" ? "招标审查" : "投标审查"}</Badge>
              <Badge variant={riskBadge(task.riskLevel)}>{task.riskLevel}风险</Badge>
              {task.attemptCount > 1 && <Badge variant="outline">第 {task.attemptCount} 次执行</Badge>}
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
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
            <CardTitle className="text-base">概况</CardTitle>
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

      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">关联文件</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {documentsLoading && <p className="text-sm text-muted-foreground">文件加载中...</p>}
          {!documentsLoading && relatedDocuments.length === 0 && (
            <p className="text-sm text-muted-foreground">当前任务没有关联文件。</p>
          )}

          {relatedDocuments.map((document) => (
            <div key={document.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{document.originalName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {document.role} · {document.pageCount} 页 · {parseMethodLabel(document.parseMethod)}
                  </p>
                </div>
                <Badge variant="outline">{document.parseStatus}</Badge>
              </div>
              <p className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                {document.textPreview || "暂无解析摘要"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base">问题清单</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">在任务详情页内直接查看、筛选和复核当前任务的问题结果。</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="border-destructive/20 bg-destructive/5 shadow-none">
              <CardContent className="flex items-center gap-3 p-4">
                <XCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-2xl font-bold text-destructive">{highCount}</p>
                  <p className="text-sm text-muted-foreground">高风险</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-warning/20 bg-warning/5 shadow-none">
              <CardContent className="flex items-center gap-3 p-4">
                <AlertTriangle className="h-8 w-8 text-warning" />
                <div>
                  <p className="text-2xl font-bold text-warning">{midCount}</p>
                  <p className="text-sm text-muted-foreground">中风险</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-success/20 bg-success/5 shadow-none">
              <CardContent className="flex items-center gap-3 p-4">
                <CheckCircle2 className="h-8 w-8 text-success" />
                <div>
                  <p className="text-2xl font-bold text-success">{lowCount}</p>
                  <p className="text-sm text-muted-foreground">低风险</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="搜索问题..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-10" />
            </div>

            <Select value={humanReviewFilter} onValueChange={(value) => setHumanReviewFilter(value as typeof humanReviewFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="人工复核筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部复核状态</SelectItem>
                <SelectItem value="needs_review">仅需人工复核</SelectItem>
                <SelectItem value="no_review">仅无需人工复核</SelectItem>
              </SelectContent>
            </Select>

            <Select value={confidenceFilter} onValueChange={(value) => setConfidenceFilter(value as typeof confidenceFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="置信度筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部置信度</SelectItem>
                <SelectItem value="ge_80">80% 以上</SelectItem>
                <SelectItem value="ge_60">60% 以上</SelectItem>
                <SelectItem value="lt_60">60% 以下</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">全部 ({filteredFindings.length})</TabsTrigger>
              <TabsTrigger value="cross">跨章节冲突</TabsTrigger>
              <TabsTrigger value="pending">待复核</TabsTrigger>
              <TabsTrigger value="confirmed">已确认</TabsTrigger>
              <TabsTrigger value="ignored">已忽略</TabsTrigger>
            </TabsList>

            {["all", "cross", "pending", "confirmed", "ignored"].map((tab) => {
              const statusMap: Record<string, string | null> = {
                all: null,
                cross: null,
                pending: "待复核",
                confirmed: "已确认",
                ignored: "已忽略",
              };

              const tabFiltered = filteredFindings.filter((finding) => {
                if (tab === "cross" && finding.reviewStage !== "cross_section_review") return false;
                return !statusMap[tab] || finding.status === statusMap[tab];
              });

              return (
                <TabsContent key={tab} value={tab} className="mt-4">
                  {findingsLoading ? (
                    <p className="p-4 text-sm text-muted-foreground">问题加载中...</p>
                  ) : tabFiltered.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">当前筛选条件下暂无问题。</p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-border">
                      <div className="divide-y divide-border">{tabFiltered.map(renderIssueRow)}</div>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!selectedIssue} onOpenChange={() => setSelectedIssue(null)}>
        <DialogContent className="max-w-4xl">
          {selectedIssue && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {riskIcon(selectedIssue.risk)}
                  {selectedIssue.title}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{reviewStageLabel(selectedIssue.reviewStage)}</Badge>
                  <Badge variant={riskBadge(selectedIssue.risk)}>{selectedIssue.risk}风险</Badge>
                  <Badge variant="outline">{selectedIssue.category}</Badge>
                  <Badge variant="outline">{selectedIssue.status}</Badge>
                  <Badge variant="outline">置信度 {Math.round(selectedIssue.confidence * 100)}%</Badge>
                  {selectedIssue.needsHumanReview && <Badge variant="outline">建议人工复核</Badge>}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">原文定位</Label>
                  <p className="mt-1 rounded-lg bg-muted p-3 text-sm">
                    {selectedIssue.location} - {selectedIssue.project}
                  </p>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">问题描述</Label>
                  <p className="mt-1 text-sm text-foreground">{selectedIssue.description}</p>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">处理建议</Label>
                  <p className="mt-1 text-sm text-foreground">{selectedIssue.recommendation}</p>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">引用依据</Label>
                  <div className="mt-2 space-y-2">
                    {selectedIssue.references.map((reference) => (
                      <p key={reference} className="rounded-lg bg-muted px-3 py-2 text-sm">
                        {reference}
                      </p>
                    ))}
                  </div>
                </div>

                <ChunkGroup
                  title="招标原文片段"
                  items={selectedIssue.sourceChunks.map((chunk) => ({
                    label: `${chunk.documentName} · 片段 ${chunk.order}`,
                    text: chunk.text,
                  }))}
                />

                <ChunkGroup
                  title="投标响应片段"
                  items={selectedIssue.candidateChunks.map((chunk) => ({
                    label: `${chunk.documentName} · 片段 ${chunk.order}`,
                    text: chunk.text,
                  }))}
                />

                <ChunkGroup
                  title="法规依据片段"
                  items={selectedIssue.regulationChunks.map((chunk) => ({
                    label: `${chunk.regulationName} [${chunk.regulationCategory}]${chunk.sectionTitle ? ` · ${chunk.sectionTitle}` : ""} · 片段 ${chunk.order}`,
                    text: chunk.text,
                  }))}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">复核人</Label>
                    <Input
                      value={reviewer}
                      onChange={(event) => setReviewer(event.target.value)}
                      placeholder="输入复核人姓名"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">新备注</Label>
                    <Textarea
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                      placeholder="输入复核意见..."
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={!reviewNote.trim() || !reviewer.trim() || addReviewLogMutation.isPending}
                    onClick={submitNote}
                  >
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                    保存备注
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={updateFindingMutation.isPending || (!!reviewNote.trim() && !reviewer.trim())}
                    onClick={() => updateFindingMutation.mutate({ id: selectedIssue.id, status: "已确认" })}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    确认问题
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={updateFindingMutation.isPending || (!!reviewNote.trim() && !reviewer.trim())}
                    onClick={() => updateFindingMutation.mutate({ id: selectedIssue.id, status: "已忽略" })}
                  >
                    忽略
                  </Button>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">复核历史</Label>
                  <div className="mt-2 space-y-2">
                    {selectedIssue.reviewLogs.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                        还没有复核记录。
                      </div>
                    )}
                    {selectedIssue.reviewLogs.map((log) => (
                      <div key={log.id} className="rounded-lg border border-border bg-muted/40 p-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{formatReviewAction(log.action)}</Badge>
                          {log.status && <Badge variant="outline">{log.status}</Badge>}
                          <span>{log.reviewer}</span>
                          <span>·</span>
                          <span>{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="mt-2 text-sm text-foreground">{log.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaskDetail;
