import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Upload as UploadIcon,
  FileText,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">选择项目</CardTitle>
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

  const renderDropZone = (role: UploadRole, title: string, files: DocumentItem[]) => (
    <div className="space-y-4">
      <input
        ref={role === "tender" ? tenderInputRef : bidInputRef}
        type="file"
        accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp"
        className="hidden"
        multiple
        onChange={(event) => handleFileUpload(event.target.files, role)}
      />

      <Card
        className={`cursor-pointer border-2 border-dashed transition-colors ${
          dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        } ${!selectedProjectId ? "cursor-not-allowed opacity-60" : ""}`}
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
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="mb-4 rounded-full bg-primary/10 p-4">
            <UploadIcon className="h-8 w-8 text-primary" />
          </div>
          <p className="font-medium text-foreground">拖拽文件到此处或点击上传</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedProjectId ? `上传${title}，仅支持 PDF、文本和图片文件` : "请先选择项目后再上传文件"}
          </p>
        </CardContent>
      </Card>

      {uploadMutation.isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          文件上传中...
        </div>
      )}

      {files.length > 0 && (
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">已上传文件</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{file.originalName}</p>
                    <p className="text-xs text-muted-foreground">
                      {toDisplaySize(file.sizeBytes)} · {file.pageCount} 页 · {parseMethodLabel(file.parseMethod)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{file.textPreview || "暂无解析摘要"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(file.parseStatus)}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8" disabled={deleteDocumentMutation.isPending}>
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

  if (step === "select") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">文件审查</h1>
          <p className="mt-1 text-muted-foreground">请选择项目，系统将根据项目类型进入对应的审查流程。</p>
        </div>

        {renderProjectSelector()}
      </div>
    );
  }

  if (step === "upload-bid") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">审查招标文件</h1>
            <p className="mt-1 text-muted-foreground">请上传需要审查的招标文件。</p>
          </div>
        </div>

        {renderProjectSelector()}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">{renderDropZone("tender", "招标文件", tenderFiles)}</div>
          <div>
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">审查说明</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">系统将自动检查</p>
                  <ul className="space-y-1">
                    <li>· 招标文件格式与完整性</li>
                    <li>· 条款合规性审查</li>
                    <li>· 评分标准合理性</li>
                    <li>· 资质要求合法性</li>
                    <li>· 关键时间节点校验</li>
                  </ul>
                </div>
                <Button
                  className="w-full"
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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (step === "upload-tender-bid") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">审查投标文件</h1>
            <p className="mt-1 text-muted-foreground">第 1 步：请先上传招标文件作为审查参照。</p>
          </div>
          <Badge variant="outline" className="ml-auto text-xs">
            步骤 1/2
          </Badge>
        </div>

        {renderProjectSelector()}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">{renderDropZone("tender", "招标文件", tenderFiles)}</div>
          <div>
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">流程说明</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    1
                  </div>
                  <p className="text-sm font-medium text-foreground">上传招标文件</p>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted-foreground/20 text-xs font-bold text-muted-foreground">
                    2
                  </div>
                  <p className="text-sm text-muted-foreground">上传投标文件</p>
                </div>
                <Button className="w-full" disabled={!latestTender} onClick={() => setStep("upload-tender-tender")}>
                  下一步
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">审查投标文件</h1>
          <p className="mt-1 text-muted-foreground">第 2 步：请上传需要审查的投标文件。</p>
        </div>
        <Badge variant="outline" className="ml-auto text-xs">
          步骤 2/2
        </Badge>
      </div>

      {renderProjectSelector()}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">{renderDropZone("bid", "投标文件", bidFiles)}</div>
        <div className="space-y-4">
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">流程说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/5 p-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-xs font-bold text-success-foreground">
                  ✓
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">招标文件已上传</p>
                  <p className="text-xs text-muted-foreground">{tenderFiles.length} 个文件</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  2
                </div>
                <p className="text-sm font-medium text-foreground">上传投标文件</p>
              </div>
              <Button
                className="w-full"
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Upload;
