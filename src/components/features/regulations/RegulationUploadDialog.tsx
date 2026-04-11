import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RegulationDraft } from "@/lib/api-types";
import RegulationDraftEditor from "./RegulationDraftEditor";

interface RegulationUploadDialogProps {
  open: boolean;
  uploadFile: File | null;
  draft: RegulationDraft | null;
  previewPending: boolean;
  confirmPending: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadFileChange: (file: File | null) => void;
  onPreviewUpload: () => void;
  onConfirmDraft: () => void;
  onNameChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onUpdatedChange: (value: string) => void;
  onTextPreviewChange: (value: string) => void;
  onAddSection: () => void;
  onUpdateSectionTitle: (index: number, value: string) => void;
  onUpdateSectionRules: (index: number, value: number) => void;
  onRemoveSection: (index: number) => void;
  onAddChunk: () => void;
  onMoveChunk: (fromIndex: number, toIndex: number) => void;
  onRemoveChunk: (index: number) => void;
  onUpdateChunkText: (index: number, value: string) => void;
  onUpdateChunkSection: (index: number, value: string) => void;
}

const RegulationUploadDialog = ({
  open,
  uploadFile,
  draft,
  previewPending,
  confirmPending,
  onOpenChange,
  onUploadFileChange,
  onPreviewUpload,
  onConfirmDraft,
  onNameChange,
  onCategoryChange,
  onUpdatedChange,
  onTextPreviewChange,
  onAddSection,
  onUpdateSectionTitle,
  onUpdateSectionRules,
  onRemoveSection,
  onAddChunk,
  onMoveChunk,
  onRemoveChunk,
  onUpdateChunkText,
  onUpdateChunkSection,
}: RegulationUploadDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogTrigger asChild>
      <Button variant="outline">
        <Upload className="mr-2 h-4 w-4" />
        上传法规文件
      </Button>
    </DialogTrigger>
    <DialogContent className="max-w-5xl">
      <DialogHeader>
        <DialogTitle>上传法规文件</DialogTitle>
        <DialogDescription>支持 PDF、文本和图片类法规文件，系统会自动识别文本并整理入库。</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>法规文件</Label>
          <Input
            type="file"
            accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp"
            className="mt-2"
            onChange={(e) => onUploadFileChange(e.target.files?.[0] ?? null)}
          />
        </div>

        {draft && (
          <RegulationDraftEditor
            draft={draft}
            onNameChange={onNameChange}
            onCategoryChange={onCategoryChange}
            onUpdatedChange={onUpdatedChange}
            onTextPreviewChange={onTextPreviewChange}
            onAddSection={onAddSection}
            onUpdateSectionTitle={onUpdateSectionTitle}
            onUpdateSectionRules={onUpdateSectionRules}
            onRemoveSection={onRemoveSection}
            onAddChunk={onAddChunk}
            onMoveChunk={onMoveChunk}
            onRemoveChunk={onRemoveChunk}
            onUpdateChunkText={onUpdateChunkText}
            onUpdateChunkSection={onUpdateChunkSection}
          />
        )}
      </div>
      <DialogFooter>
        {!draft ? (
          <Button onClick={onPreviewUpload} disabled={!uploadFile || previewPending}>
            {previewPending ? "识别中..." : "上传并识别"}
          </Button>
        ) : (
          <Button onClick={onConfirmDraft} disabled={confirmPending}>
            {confirmPending ? "保存中..." : "确认入库"}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default RegulationUploadDialog;
