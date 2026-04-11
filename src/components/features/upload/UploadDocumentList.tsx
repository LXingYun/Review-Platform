import { FileText, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DocumentItem } from "@/lib/api-types";
import { formatDocumentParseMethodLabel } from "@/lib/formatters/document";
import UploadParseStatusBadge from "./UploadParseStatusBadge";

interface UploadDocumentListProps {
  files: DocumentItem[];
  isDeleting: boolean;
  onDeleteFile: (fileId: string) => void;
}

const toDisplaySize = (sizeBytes: number) => `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;

const UploadDocumentList = ({ files, isDeleting, onDeleteFile }: UploadDocumentListProps) => {
  if (files.length === 0) return null;

  return (
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
                  {toDisplaySize(file.sizeBytes)} · {file.pageCount} 页 · {formatDocumentParseMethodLabel(file.parseMethod)}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-6 text-muted-foreground">
                  {file.textPreview || "暂无解析摘要"}
                </p>
              </div>
            </div>
            <div className="ml-4 flex shrink-0 items-center gap-2">
              <UploadParseStatusBadge status={file.parseStatus} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" disabled={isDeleting}>
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
                      onClick={() => onDeleteFile(file.id)}
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
  );
};

export default UploadDocumentList;
