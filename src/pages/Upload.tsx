import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  Upload as UploadIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import { DocumentItem, ProjectListItem, ReviewTaskResult } from "@/lib/api-types";
import { useToast } from "@/hooks/use-toast";

type ReviewType = "bid" | "tender" | null;
type Step = "select" | "upload-bid" | "upload-tender-bid" | "upload-tender-tender";
type UploadRole = "tender" | "bid";

const toDisplaySize = (sizeBytes: number) => `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;

const parseMethodLabel = (parseMethod: DocumentItem["parseMethod"]) => {
  if (parseMethod === "pdf-text") return "PDF 文本";
  if (parseMethod === "plain-text") return "纯文本";
  if (parseMethod === "image-ocr") return "图片 OCR";
  return "占位解析";
};

const reviewTypeFromProjectType = (projectType: ProjectListItem["type"]): ReviewType => {
  if (projectType === "招标审查") return "bid";
  if (projectType === "投标审查") return "tender";
  return null;
};

const Upload = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const tenderInputRef = useRef<HTMLInputElement | null>(null);
  const bidInputRef = useRef<HTMLInputElement | null>(null);

  const [reviewType, setReviewType] = useState<ReviewType>(null);
  const [step, setStep] = useState<Step>("select");
  const [dragActive, setDragActive] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const presetProjectId = searchParams.get("projectId") ?? "";

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "upload"],
    queryFn: () => apiRequest<ProjectListItem[]>("/projects"),
  });

  useEffect(() => {
    if (!presetProjectId || selectedProjectId) return;
    const project = projects.find((item) => item.id === presetProjectId);
    if (!project) return;

    setSelectedProjectId(presetProjectId);
    setReviewType((current) => current ?? reviewTypeFromProjectType(project.type));
  }, [presetProjectId, projects, selectedProjectId]);

  const { data: documents = [] } = useQuery({
    queryKey: ["documents", selectedProjectId],
    queryFn: () => apiRequest<DocumentItem[]>(`/documents?projectId=${encodeURIComponent(selectedProjectId)}`),
    enabled: Boolean(selectedProjectId),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, role }: { file: File; role: UploadRole }) => {
      if (!selectedProjectId) {
        throw new Error("请先选择项目");
      }

      const formData = new FormData();
      formData.append("projectId", selectedProjectId);
      formData.append("role", role);
      formData.append("file", file);

      return apiRequest<DocumentItem>("/documents/upload", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["documents", selectedProjectId] });
      toast({
        title: "上传成功",
        description: `${variables.file.name} 已完成上传并进入可审查状态。`,
      });
    },
    onError: (error) => {
      toast({
        title: "上传失败",
        description: error instanceof Error ? error.message : "文件上传失败，请稍后再试。",
        variant: "destructive",
      });
    },
  });

  const tenderReviewMutation = useMutation({
    mutationFn: (payload: { projectId: string; tenderDocumentId: string }) =>
      apiRequest<ReviewTaskResult>("/reviews/tender-compliance", {
        method: "POST",
        body: JSON.stringify({
          projectId: payload.projectId,
          tenderDocumentId: payload.tenderDocumentId,
          regulationIds: [],
        }),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["findings"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["review-tasks"] });
      toast({
        title: "审查任务已创建",
        description: `${result.task.name} 已进入审查队列。`,
      });
      navigate(`/tasks/${result.task.id}`);
    },
    onError: (error) => {
      toast({
        title: "创建审查失败",
        description: error instanceof Error ? error.message : "请稍后重试。",
        variant: "destructive",
      });
    },
  });

  const bidReviewMutation = useMutation({
    mutationFn: (payload: { projectId: string; tenderDocumentId: string; bidDocumentId: string }) =>
      apiRequest<ReviewTaskResult>("/reviews/bid-consistency", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["findings"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["review-tasks"] });
      toast({
        title: "审查任务已创建",
        description: `${result.task.name} 已进入审查队列。`,
      });
      navigate(`/tasks/${result.task.id}`);
    },
    onError: (error) => {
      toast({
        title: "创建审查失败",
        description: error instanceof Error ? error.message : "请稍后重试。",
        variant: "destructive",
      });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) =>
      apiRequest<{ success: boolean; documentId: string }>(`/documents/${documentId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ["review-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["findings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({
        title: "文件已删除",
        description: "关联的审查任务和结果已同步清理。",
      });
    },
    onError: (error) => {
      toast({
        title: "删除失败",
        description: error instanceof Error ? error.message : "请稍后重试。",
        variant: "destructive",
      });
    },
  });

  const handleDrag = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(event.type === "dragenter" || event.type === "dragover");
  }, []);

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    const project = projects.find((item) => item.id === projectId);
    setReviewType(project ? reviewTypeFromProjectType(project.type) : null);
    setStep("select");
  };

  useEffect(() => {
    if (!selectedProjectId || !reviewType || step !== "select") return;
    setStep(reviewType === "bid" ? "upload-bid" : "upload-tender-bid");
  }, [selectedProjectId, reviewType, step]);

  const handleBack = () => {
    if (step === "upload-bid" || step === "upload-tender-bid") {
      setStep("select");
      return;
    }

    if (step === "upload-tender-tender") {
      setStep("upload-tender-bid");
    }
  };

  const tenderFiles = useMemo(() => documents.filter((document) => document.role === "tender"), [documents]);
  const bidFiles = useMemo(() => documents.filter((document) => document.role === "bid"), [documents]);
  const latestTender = tenderFiles[0];
  const latestBid = bidFiles[0];

  const handleFileUpload = (files: FileList | null, role: UploadRole) => {
    if (!files?.length) return;
    Array.from(files).forEach((file) => {
      uploadMutation.mutate({ file, role });
    });
  };

  const openPicker = (role: UploadRole) => {
    if (role === "tender") {
      tenderInputRef.current?.click();
      return;
    }

    bidInputRef.current?.click();
  };

  const statusBadge = (status: DocumentItem["parseStatus"]) => {
    if (status === "待解析") {
      return (
        <Badge variant="secondary">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          待解析
        </Badge>
      );
    }

    if (status === "解析中") {
      return (
        <Badge variant="secondary" className="border-warning/20 bg-warning/10 text-warning">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          解析中
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="border-success/20 bg-success/10 text-success">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        已完成
      </Badge>
    );
  };

  const renderProjectSelector = () => (
    <Card className="surface-panel bg-card/85">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">选择项目</CardTitle>
        <CardDescription>系统会根据项目类型自动切换到对应的审查流程。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label>当前审查任务所属项目</Label>
        <Select value={selectedProjectId} onValueChange={handleProjectChange}>
          <SelectTrigger>
            <SelectValue placeholder="请选择一个项目" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name} · {project.type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );

  const renderDropZone = (role: UploadRole, title: string, files: DocumentItem[], stretchPrimaryCard = false) => (
    <div className="flex h-full flex-col gap-5">
      <input
        ref={role === "tender" ? tenderInputRef : bidInputRef}
        type="file"
        accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp"
        className="hidden"
        multiple
        onChange={(event) => handleFileUpload(event.target.files, role)}
      />

      <Card
        className={`surface-paper cursor-pointer overflow-hidden border-2 border-dashed transition-all duration-200 ${
          dragActive
            ? "border-[hsl(var(--accent))] bg-background/90"
            : "border-border hover:-translate-y-0.5 hover:border-primary/30 hover:bg-background/85"
        } ${!selectedProjectId ? "cursor-not-allowed opacity-60" : ""} ${stretchPrimaryCard ? "flex-1" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={(event) => {
          handleDrag(event);
          if (!selectedProjectId) return;
          handleFileUpload(event.dataTransfer.files, role);
        }}
        onClick={() => {
          if (!selectedProjectId) return;
          openPicker(role);
        }}
      >
        <CardContent className={`flex flex-col items-center justify-center px-6 py-16 text-center ${stretchPrimaryCard ? "h-full" : ""}`}>
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-border/80 bg-background text-primary">
            <UploadIcon className="h-7 w-7" />
          </div>
          <h3 className="font-display text-3xl text-foreground">{title}</h3>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            支持拖拽或点击上传。文件会先完成解析，再进入后续审查流程。
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Badge variant="outline">支持 PDF</Badge>
            <Badge variant="outline">支持文本</Badge>
            <Badge variant="outline">支持图片</Badge>
          </div>
        </CardContent>
      </Card>

      {uploadMutation.isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          文件上传中...
        </div>
      )}

      {files.length > 0 && (
        <Card className="surface-panel bg-card/85">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">已上传资料</CardTitle>
            <CardDescription>这里会保留文件摘要、页数和解析方式，便于确认是否可进入下一步。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between rounded-[22px] border border-border/80 bg-background/80 p-3 transition-colors hover:bg-background"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-border/80 bg-background text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{file.originalName}</p>
                    <p className="text-xs text-muted-foreground">
                      {toDisplaySize(file.sizeBytes)} · {file.pageCount} 页 · {parseMethodLabel(file.parseMethod)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-6 text-muted-foreground">
                      {file.textPreview || "暂无解析摘要"}
                    </p>
                  </div>
                </div>
                <div className="ml-4 flex items-center gap-2">
                  {statusBadge(file.parseStatus)}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" disabled={deleteDocumentMutation.isPending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>删除已上传文件？</AlertDialogTitle>
                        <AlertDialogDescription>
                          删除后会移除文件记录、物理文件，以及使用该文件生成的审查任务和结果。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteDocumentMutation.mutate(file.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          确认删除
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderLead = (params: {
    eyebrow: string;
    title: string;
    description: string;
    stepBadge?: string;
  }) => (
    <div className="flex flex-col gap-4 rounded-[28px] border border-border/80 bg-card/55 px-5 py-5 md:flex-row md:items-end md:justify-between">
      <div className="space-y-3">
        <span className="eyebrow">{params.eyebrow}</span>
        <div className="max-w-3xl space-y-2">
          <h1 className="font-display text-3xl leading-[1.12] text-foreground md:text-4xl">{params.title}</h1>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">{params.description}</p>
        </div>
      </div>
      {params.stepBadge && (
        <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-[11px] tracking-[0.18em] text-muted-foreground">
          {params.stepBadge}
        </Badge>
      )}
    </div>
  );

  if (step === "select") {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-10">
        {renderLead({
          eyebrow: "审查入口",
          title: "先选择项目，再进入对应的文件审查流程",
          description: "项目类型会决定接下来进入招标审查还是投标审查，不再额外展示说明型大卡片。",
        })}
        {renderProjectSelector()}
      </div>
    );
  }

  if (step === "upload-bid") {
    return (
      <div className="mx-auto max-w-6xl space-y-6 pb-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>

        {renderLead({
          eyebrow: "招标审查",
          title: "上传需要审查的招标文件",
          description: "文件会先完成解析，再进入招标文件合规审查与章节级风险检查。",
        })}

        {renderProjectSelector()}
        {renderDropZone("tender", "上传招标文件", tenderFiles)}

        <div className="flex justify-end">
          <Button
            className="rounded-full px-6"
            disabled={!latestTender || tenderReviewMutation.isPending}
            onClick={() =>
              latestTender &&
              tenderReviewMutation.mutate({
                projectId: selectedProjectId,
                tenderDocumentId: latestTender.id,
              })
            }
          >
            {tenderReviewMutation.isPending ? "创建审查中..." : "开始审查"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "upload-tender-bid") {
    return (
      <div className="mx-auto max-w-6xl space-y-6 pb-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>

        {renderLead({
          eyebrow: "投标审查",
          title: "先上传招标文件，作为投标审查的参照底稿",
          description: "投标文件不会单独判断，它必须和招标要求放在同一轮审查上下文里。",
          stepBadge: "步骤 1 / 2",
        })}

        {renderProjectSelector()}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px] xl:items-stretch">
          <div className="flex h-full flex-col">{renderDropZone("tender", "上传招标文件", tenderFiles, true)}</div>
          <Card className="surface-panel flex h-full flex-col bg-card/85">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">当前流程</CardTitle>
              <CardDescription>流程说明收紧为侧栏提示，不再单独占据首屏。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <div className="rounded-[18px] border border-primary/20 bg-primary px-4 py-3 text-sm text-primary-foreground">
                01 上传招标文件
              </div>
              <div className="rounded-[18px] border border-border/80 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                02 上传投标文件
              </div>
              <div className="mt-auto pt-3">
                <Button className="w-full rounded-full" disabled={!latestTender} onClick={() => setStep("upload-tender-tender")}>
                  下一步
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      {renderLead({
        eyebrow: "投标审查",
        title: "现在上传投标文件，形成完整的比对语境",
        description: "招标要求已经归档完成，接下来这份投标文件会与其进行响应性和一致性审查。",
        stepBadge: "步骤 2 / 2",
      })}

      {renderProjectSelector()}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px] xl:items-stretch">
        <div className="flex h-full flex-col">{renderDropZone("bid", "上传投标文件", bidFiles, true)}</div>
        <Card className="surface-panel flex h-full flex-col bg-card/85">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">流程摘要</CardTitle>
            <CardDescription>你已经完成审查前的上下文准备。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <div className="rounded-[18px] border border-success/20 bg-success/5 px-4 py-3">
              <p className="text-sm font-medium text-foreground">招标文件已就绪</p>
              <p className="mt-1 text-xs text-muted-foreground">{tenderFiles.length} 个文件</p>
            </div>
            <div className="rounded-[18px] border border-primary/20 bg-primary px-4 py-3 text-sm text-primary-foreground">
              02 上传投标文件
            </div>
            <div className="mt-auto pt-3">
              <Button
                className="w-full rounded-full"
                disabled={!latestTender || !latestBid || bidReviewMutation.isPending}
                onClick={() =>
                  latestTender &&
                  latestBid &&
                  bidReviewMutation.mutate({
                    projectId: selectedProjectId,
                    tenderDocumentId: latestTender.id,
                    bidDocumentId: latestBid.id,
                  })
                }
              >
                {bidReviewMutation.isPending ? "创建审查中..." : "开始审查"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Upload;
