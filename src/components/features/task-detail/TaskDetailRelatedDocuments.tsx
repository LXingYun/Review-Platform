import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DocumentItem } from "@/lib/api-types";
import { formatDocumentParseMethodLabel } from "@/lib/formatters/document";

interface TaskDetailRelatedDocumentsProps {
  documentsLoading: boolean;
  relatedDocuments: DocumentItem[];
}

const TaskDetailRelatedDocuments = ({
  documentsLoading,
  relatedDocuments,
}: TaskDetailRelatedDocumentsProps) => (
  <Card className="surface-panel border-border/80 bg-card/90">
    <CardHeader className="pb-3">
      <CardTitle className="text-base">关联文件</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      {documentsLoading && <p className="text-sm text-muted-foreground">文件加载中...</p>}
      {!documentsLoading && relatedDocuments.length === 0 && (
        <p className="text-sm text-muted-foreground">当前任务没有关联文件。</p>
      )}

      {relatedDocuments.map((document) => (
        <div key={document.id} className="rounded-[24px] border border-border/80 bg-background/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-foreground">{document.originalName}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {document.role} · {document.pageCount} 页 · {formatDocumentParseMethodLabel(document.parseMethod)}
              </p>
            </div>
            <Badge variant="outline">{document.parseStatus}</Badge>
          </div>
          <p className="mt-4 rounded-[18px] border border-border/70 bg-background/88 p-4 text-sm leading-7 text-muted-foreground">
            {document.textPreview || "暂无解析摘要"}
          </p>
        </div>
      ))}
    </CardContent>
  </Card>
);

export default TaskDetailRelatedDocuments;
