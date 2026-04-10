import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useCreateBidReviewMutation,
  useCreateTenderReviewMutation,
  useDeleteDocumentMutation,
  useDocumentsQuery,
  useProjectsQuery,
  useUploadDocumentMutation,
} from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import type { ProjectListItem } from "@/lib/api-types";
import UploadDropZoneSection from "./UploadDropZoneSection";
import UploadLead from "./UploadLead";
import UploadProjectSelector from "./UploadProjectSelector";
import type { ReviewType, UploadRole, UploadStep } from "./types";

const reviewTypeFromProjectType = (projectType: ProjectListItem["type"]): ReviewType => {
  if (projectType === "招标审查") return "bid";
  if (projectType === "投标审查") return "tender";
  return null;
};

const UploadPageContainer = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const tenderInputRef = useRef<HTMLInputElement | null>(null);
  const bidInputRef = useRef<HTMLInputElement | null>(null);

  const [reviewType, setReviewType] = useState<ReviewType>(null);
  const [step, setStep] = useState<UploadStep>("select");
  const [dragActive, setDragActive] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const presetProjectId = searchParams.get("projectId") ?? "";

  const { data: projects = [] } = useProjectsQuery();

  useEffect(() => {
    if (!presetProjectId || selectedProjectId) return;
    const project = projects.find((item) => item.id === presetProjectId);
    if (!project) return;

    setSelectedProjectId(presetProjectId);
    setReviewType((current) => current ?? reviewTypeFromProjectType(project.type));
  }, [presetProjectId, projects, selectedProjectId]);

  const { data: documents = [] } = useDocumentsQuery({
    projectId: selectedProjectId,
    enabled: Boolean(selectedProjectId),
  });

  const uploadMutation = useUploadDocumentMutation({
    onSuccess: (_, variables) => {
      toast({
        title: "上传成功",
        description: `${variables.file.name} 已完成上传并进入可审查状态。`,
      });
    },
    onError: (error) => {
      toast({
        title: "上传失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const tenderReviewMutation = useCreateTenderReviewMutation({
    onSuccess: (result) => {
      toast({
        title: "审查任务已创建",
        description: `${result.task.name} 已进入审查队列。`,
      });
      navigate(`/tasks/${result.task.id}`);
    },
    onError: (error) => {
      toast({
        title: "创建审查失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bidReviewMutation = useCreateBidReviewMutation({
    onSuccess: (result) => {
      toast({
        title: "审查任务已创建",
        description: `${result.task.name} 已进入审查队列。`,
      });
      navigate(`/tasks/${result.task.id}`);
    },
    onError: (error) => {
      toast({
        title: "创建审查失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteDocumentMutation = useDeleteDocumentMutation({
    onSuccess: () => {
      toast({
        title: "文件已删除",
        description: "关联的审查任务和结果已同步清理。",
      });
    },
    onError: (error) => {
      toast({
        title: "删除失败",
        description: error.message,
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

  const tenderFiles = useMemo(() => documents.filter((document) => document.role === "tender"), [documents]);
  const bidFiles = useMemo(() => documents.filter((document) => document.role === "bid"), [documents]);
  const latestTender = tenderFiles[0];
  const latestBid = bidFiles[0];

  const handleFileUpload = (files: FileList | null, role: UploadRole) => {
    if (!files?.length || !selectedProjectId) return;

    Array.from(files).forEach((file) => {
      uploadMutation.mutate({ projectId: selectedProjectId, file, role });
    });
  };

  const openPicker = (role: UploadRole) => {
    if (role === "tender") {
      tenderInputRef.current?.click();
      return;
    }

    bidInputRef.current?.click();
  };

  const renderProjectSelector = () => (
    <UploadProjectSelector
      projects={projects}
      selectedProjectId={selectedProjectId}
      onProjectChange={handleProjectChange}
    />
  );

  if (step === "select") {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-10">
        <UploadLead
          eyebrow="审查入口"
          title="先选择项目，再进入对应的文件审查流程"
          description="项目类型会决定接下来进入招标审查还是投标审查，不再额外展示说明型大卡片。"
        />
        {renderProjectSelector()}
      </div>
    );
  }

  if (step === "upload-bid") {
    return (
      <div className="mx-auto max-w-6xl space-y-6 pb-10">
        <UploadLead
          eyebrow="招标审查"
          title="上传需要审查的招标文件"
          description="文件会先完成解析，再进入招标文件合规审查与章节级风险检查。"
        />

        {renderProjectSelector()}
        <UploadDropZoneSection
          role="tender"
          title="上传招标文件"
          files={tenderFiles}
          selectedProjectId={selectedProjectId}
          dragActive={dragActive}
          isUploading={uploadMutation.isPending}
          isDeleting={deleteDocumentMutation.isPending}
          inputRef={tenderInputRef}
          onDrag={handleDrag}
          onFilesSelected={handleFileUpload}
          onOpenPicker={openPicker}
          onDeleteFile={(fileId) => deleteDocumentMutation.mutate(fileId)}
        />

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
        <UploadLead
          eyebrow="投标审查"
          title="先上传招标文件，作为投标审查的参照底稿"
          description="投标文件不会单独判断，它必须和招标要求放在同一轮审查上下文里。"
          stepBadge="步骤 1 / 2"
        />

        {renderProjectSelector()}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px] xl:items-stretch">
          <div className="flex h-full flex-col">
            <UploadDropZoneSection
              role="tender"
              title="上传招标文件"
              files={tenderFiles}
              selectedProjectId={selectedProjectId}
              dragActive={dragActive}
              isUploading={uploadMutation.isPending}
              isDeleting={deleteDocumentMutation.isPending}
              stretchPrimaryCard
              inputRef={tenderInputRef}
              onDrag={handleDrag}
              onFilesSelected={handleFileUpload}
              onOpenPicker={openPicker}
              onDeleteFile={(fileId) => deleteDocumentMutation.mutate(fileId)}
            />
          </div>
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
      <UploadLead
        eyebrow="投标审查"
        title="现在上传投标文件，形成完整的比对语境"
        description="招标要求已经归档完成，接下来这份投标文件会与其进行响应性和一致性审查。"
        stepBadge="步骤 2 / 2"
      />

      {renderProjectSelector()}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px] xl:items-stretch">
        <div className="flex h-full flex-col">
          <UploadDropZoneSection
            role="bid"
            title="上传投标文件"
            files={bidFiles}
            selectedProjectId={selectedProjectId}
            dragActive={dragActive}
            isUploading={uploadMutation.isPending}
            isDeleting={deleteDocumentMutation.isPending}
            stretchPrimaryCard
            inputRef={bidInputRef}
            onDrag={handleDrag}
            onFilesSelected={handleFileUpload}
            onOpenPicker={openPicker}
            onDeleteFile={(fileId) => deleteDocumentMutation.mutate(fileId)}
          />
        </div>
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

export default UploadPageContainer;
