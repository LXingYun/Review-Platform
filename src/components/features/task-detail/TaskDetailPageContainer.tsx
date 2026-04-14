import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { FindingListItem } from "@/lib/api-types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useAbortReviewTaskMutation,
  useAddFindingReviewLogMutation,
  useDeleteReviewTaskMutation,
  useDocumentsQuery,
  useReviewTaskQuery,
  useRetryReviewTaskMutation,
  useTaskFindingsQuery,
  useUpdateFindingStatusMutation,
} from "@/hooks/queries";
import { useReviewNoteDraft } from "@/hooks/use-review-note-draft";
import { usePageVisibility } from "@/hooks/use-page-visibility";
import { useTaskEventStream } from "@/hooks/use-task-event-stream";
import { useUnsavedNavigationGuard } from "@/hooks/use-unsaved-navigation-guard";
import FindingDetailDialog from "./FindingDetailDialog";
import TaskDetailFindingsPanel from "./TaskDetailFindingsPanel";
import TaskDetailHeader from "./TaskDetailHeader";
import TaskDetailOverview from "./TaskDetailOverview";
import TaskDetailRelatedDocuments from "./TaskDetailRelatedDocuments";

const reviewerStorageKey = "review-platform-reviewer";

const TaskDetailPageContainer = () => {
  const navigate = useNavigate();
  const { taskId = "" } = useParams();
  const [search, setSearch] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<FindingListItem | null>(null);
  const [humanReviewFilter, setHumanReviewFilter] = useState<"all" | "needs_review" | "no_review">("all");
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | "ge_80" | "ge_60" | "lt_60">("all");
  const [reviewer, setReviewer] = useState("");
  const { isPageVisible } = usePageVisibility();
  const selectedIssueId = selectedIssue?.id ?? "";
  const { reviewNote, setReviewNote, clearDraft, hasUnsavedDraft } = useReviewNoteDraft({
    taskId,
    findingId: selectedIssueId || undefined,
  });
  const { dialogOpen, confirmNavigation, cancelNavigation, onDialogOpenChange } =
    useUnsavedNavigationGuard(hasUnsavedDraft);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setReviewer(window.localStorage.getItem(reviewerStorageKey) ?? "");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const normalizedReviewer = reviewer.trim();

    if (normalizedReviewer) {
      window.localStorage.setItem(reviewerStorageKey, reviewer);
    } else {
      window.localStorage.removeItem(reviewerStorageKey);
    }
  }, [reviewer]);

  const { isConnected: isTaskStreamConnected } = useTaskEventStream({
    taskId,
    enabled: Boolean(taskId) && isPageVisible,
  });

  const pollingInterval = !isPageVisible ? false : isTaskStreamConnected ? false : 3000;

  const { data: task, isLoading: tasksLoading } = useReviewTaskQuery(taskId, {
    enabled: Boolean(taskId),
    refetchInterval: pollingInterval,
  });

  const shouldPollFindings = Boolean(task && (task.status === "待审核" || task.status === "进行中"));

  const { data: documents = [], isLoading: documentsLoading } = useDocumentsQuery({
    projectId: task?.projectId,
    enabled: Boolean(task?.projectId),
  });

  const { data: findings = [], isLoading: findingsLoading } = useTaskFindingsQuery({
    taskId,
    enabled: Boolean(taskId),
    refetchInterval: shouldPollFindings ? pollingInterval : false,
  });

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

  const updateFindingMutation = useUpdateFindingStatusMutation({
    onSuccess: () => {
      if (selectedIssue) {
        clearDraft(selectedIssue.id);
      }
      setSelectedIssue(null);
    },
  });

  const addReviewLogMutation = useAddFindingReviewLogMutation({
    onSuccess: (updatedFinding) => {
      clearDraft(updatedFinding.id);
      setSelectedIssue(updatedFinding);
    },
  });

  const retryTaskMutation = useRetryReviewTaskMutation();
  const abortTaskMutation = useAbortReviewTaskMutation();
  const deleteTaskMutation = useDeleteReviewTaskMutation({
    onSuccess: (result) => {
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
      reviewer: reviewer.trim(),
    });
  };

  const handleConfirmFinding = () => {
    if (!selectedIssue) return;

    updateFindingMutation.mutate({
      id: selectedIssue.id,
      status: "已确认",
      note: reviewNote.trim() || undefined,
      reviewer: reviewNote.trim() ? reviewer.trim() : undefined,
    });
  };

  const handleIgnoreFinding = () => {
    if (!selectedIssue) return;

    updateFindingMutation.mutate({
      id: selectedIssue.id,
      status: "已忽略",
      note: reviewNote.trim() || undefined,
      reviewer: reviewNote.trim() ? reviewer.trim() : undefined,
    });
  };

  const renderRiskIcon = (risk: FindingListItem["risk"]) => {
    if (risk === "高") return <XCircle className="h-5 w-5 text-destructive" />;
    if (risk === "中") return <AlertTriangle className="h-5 w-5 text-warning" />;
    return <CheckCircle2 className="h-5 w-5 text-success" />;
  };

  return (
    <div className="space-y-8 pb-8">
      <TaskDetailHeader
        task={task}
        taskId={taskId}
        abortPending={abortTaskMutation.isPending}
        retryPending={retryTaskMutation.isPending}
        deletePending={deleteTaskMutation.isPending}
        onAbortTask={(nextTaskId) => abortTaskMutation.mutate(nextTaskId)}
        onRetryTask={(nextTaskId) => retryTaskMutation.mutate(nextTaskId)}
        onDeleteTask={(nextTaskId) => deleteTaskMutation.mutate(nextTaskId)}
      />

      <TaskDetailOverview
        task={task}
        relatedDocumentsCount={relatedDocuments.length}
        findingsCount={findings.length}
      />

      <TaskDetailRelatedDocuments documentsLoading={documentsLoading} relatedDocuments={relatedDocuments} />

      <TaskDetailFindingsPanel
        findingsLoading={findingsLoading}
        filteredFindings={filteredFindings}
        highCount={highCount}
        midCount={midCount}
        lowCount={lowCount}
        search={search}
        humanReviewFilter={humanReviewFilter}
        confidenceFilter={confidenceFilter}
        onSearchChange={setSearch}
        onHumanReviewFilterChange={setHumanReviewFilter}
        onConfidenceFilterChange={setConfidenceFilter}
        onSelectFinding={setSelectedIssue}
        renderRiskIcon={renderRiskIcon}
      />

      <FindingDetailDialog
        selectedIssue={selectedIssue}
        reviewer={reviewer}
        reviewNote={reviewNote}
        addReviewLogPending={addReviewLogMutation.isPending}
        updateFindingPending={updateFindingMutation.isPending}
        renderRiskIcon={renderRiskIcon}
        onOpenChange={(open) => {
          if (!open) setSelectedIssue(null);
        }}
        onReviewerChange={setReviewer}
        onReviewNoteChange={setReviewNote}
        onSubmitNote={submitNote}
        onConfirmFinding={handleConfirmFinding}
        onIgnoreFinding={handleIgnoreFinding}
      />

      <AlertDialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>草稿尚未保存</AlertDialogTitle>
            <AlertDialogDescription>
              当前复核备注草稿尚未完成提交。若继续离开页面，仍可在稍后返回该问题时恢复草稿内容。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelNavigation}>继续编辑</AlertDialogCancel>
            <AlertDialogAction onClick={confirmNavigation}>确认离开</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TaskDetailPageContainer;
