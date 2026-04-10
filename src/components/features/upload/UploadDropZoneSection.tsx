import type { DragEvent, RefObject } from "react";
import { Loader2, Upload as UploadIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DocumentItem } from "@/lib/api-types";
import type { UploadRole } from "./types";
import UploadDocumentList from "./UploadDocumentList";

interface UploadDropZoneSectionProps {
  role: UploadRole;
  title: string;
  files: DocumentItem[];
  selectedProjectId: string;
  dragActive: boolean;
  isUploading: boolean;
  isDeleting: boolean;
  stretchPrimaryCard?: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onDrag: (event: DragEvent) => void;
  onFilesSelected: (files: FileList | null, role: UploadRole) => void;
  onOpenPicker: (role: UploadRole) => void;
  onDeleteFile: (fileId: string) => void;
}

const UploadDropZoneSection = ({
  role,
  title,
  files,
  selectedProjectId,
  dragActive,
  isUploading,
  isDeleting,
  stretchPrimaryCard = false,
  inputRef,
  onDrag,
  onFilesSelected,
  onOpenPicker,
  onDeleteFile,
}: UploadDropZoneSectionProps) => (
  <div className="flex h-full flex-col gap-5">
    <input
      ref={inputRef}
      type="file"
      accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp"
      className="hidden"
      multiple
      onChange={(event) => onFilesSelected(event.target.files, role)}
    />

    <Card
      className={`surface-paper cursor-pointer overflow-hidden border-2 border-dashed transition-all duration-200 ${
        dragActive
          ? "border-[hsl(var(--accent))] bg-background/90"
          : "border-border hover:-translate-y-0.5 hover:border-primary/30 hover:bg-background/85"
      } ${!selectedProjectId ? "cursor-not-allowed opacity-60" : ""} ${stretchPrimaryCard ? "flex-1" : ""}`}
      onDragEnter={onDrag}
      onDragLeave={onDrag}
      onDragOver={onDrag}
      onDrop={(event) => {
        onDrag(event);
        if (!selectedProjectId) return;
        onFilesSelected(event.dataTransfer.files, role);
      }}
      onClick={() => {
        if (!selectedProjectId) return;
        onOpenPicker(role);
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

    {isUploading && (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        文件上传中...
      </div>
    )}

    <UploadDocumentList files={files} isDeleting={isDeleting} onDeleteFile={onDeleteFile} />
  </div>
);

export default UploadDropZoneSection;
