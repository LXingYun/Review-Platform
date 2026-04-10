import type { ReactNode } from "react";
import { CheckCircle2, MessageSquarePlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FindingListItem } from "@/lib/api-types";
import { formatReviewStageLabel, getRiskBadgeVariant } from "@/lib/formatters/review";
import ChunkGroup from "./ChunkGroup";

interface FindingDetailDialogProps {
  selectedIssue: FindingListItem | null;
  reviewer: string;
  reviewNote: string;
  addReviewLogPending: boolean;
  updateFindingPending: boolean;
  renderRiskIcon: (risk: FindingListItem["risk"]) => ReactNode;
  onOpenChange: (open: boolean) => void;
  onReviewerChange: (value: string) => void;
  onReviewNoteChange: (value: string) => void;
  onSubmitNote: () => void;
  onConfirmFinding: () => void;
  onIgnoreFinding: () => void;
}

const formatReviewAction = (action: FindingListItem["reviewLogs"][number]["action"]) => {
  if (action === "confirm") return "确认问题";
  if (action === "ignore") return "忽略问题";
  return "添加备注";
};

const FindingDetailDialog = ({
  selectedIssue,
  reviewer,
  reviewNote,
  addReviewLogPending,
  updateFindingPending,
  renderRiskIcon,
  onOpenChange,
  onReviewerChange,
  onReviewNoteChange,
  onSubmitNote,
  onConfirmFinding,
  onIgnoreFinding,
}: FindingDetailDialogProps) => (
  <Dialog open={!!selectedIssue} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-5xl">
      {selectedIssue && (
        <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {renderRiskIcon(selectedIssue.risk)}
              {selectedIssue.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{formatReviewStageLabel(selectedIssue.reviewStage)}</Badge>
              <Badge variant={getRiskBadgeVariant(selectedIssue.risk)}>{selectedIssue.risk}风险</Badge>
              <Badge variant="outline">{selectedIssue.category}</Badge>
              <Badge variant="outline">{selectedIssue.status}</Badge>
              <Badge variant="outline">置信度 {Math.round(selectedIssue.confidence * 100)}%</Badge>
              {selectedIssue.needsHumanReview && <Badge variant="outline">建议人工复核</Badge>}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">原文定位</Label>
              <p className="mt-2 rounded-[18px] border border-border/80 bg-background/80 p-4 text-sm leading-7 text-foreground">
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
                  <p key={reference} className="rounded-[18px] border border-border/80 bg-background/80 px-4 py-3 text-sm text-foreground">
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
                  onChange={(event) => onReviewerChange(event.target.value)}
                  placeholder="输入复核人姓名"
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">新备注</Label>
                <Textarea
                  value={reviewNote}
                  onChange={(event) => onReviewNoteChange(event.target.value)}
                  placeholder="输入复核意见..."
                  className="mt-2"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!reviewNote.trim() || !reviewer.trim() || addReviewLogPending} onClick={onSubmitNote}>
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                保存备注
              </Button>
              <Button
                className="flex-1"
                disabled={updateFindingPending || (!!reviewNote.trim() && !reviewer.trim())}
                onClick={onConfirmFinding}
              >
                <CheckCircle2 className="mr-1 h-4 w-4" />
                确认问题
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={updateFindingPending || (!!reviewNote.trim() && !reviewer.trim())}
                onClick={onIgnoreFinding}
              >
                忽略
              </Button>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">复核历史</Label>
              <div className="mt-2 space-y-2">
                {selectedIssue.reviewLogs.length === 0 && (
                  <div className="rounded-[18px] border border-dashed border-border p-4 text-sm text-muted-foreground">
                    还没有复核记录。
                  </div>
                )}
                {selectedIssue.reviewLogs.map((log) => (
                  <div key={log.id} className="rounded-[18px] border border-border/80 bg-background/80 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{formatReviewAction(log.action)}</Badge>
                      {log.status && <Badge variant="outline">{log.status}</Badge>}
                      <span>{log.reviewer}</span>
                      <span>·</span>
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-foreground">{log.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </DialogContent>
  </Dialog>
);

export default FindingDetailDialog;
