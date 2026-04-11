import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DocumentItem } from "@/lib/api-types";
import { formatDocumentParseMethodLabel } from "@/lib/formatters/document";

interface ProjectDocumentsCardProps {
  documentsLoading: boolean;
  documents: DocumentItem[];
}

const ProjectDocumentsCard = ({ documentsLoading, documents }: ProjectDocumentsCardProps) => (
  <Card className="surface-panel border-border/80 bg-card/90">
    <CardHeader className="pb-4">
      <CardTitle className="font-display text-[28px] text-foreground">文件清单</CardTitle>
      <CardDescription>集中管理该项目下的所有相关文档，支持快速预览与下载。</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {documentsLoading && <p className="text-sm text-muted-foreground">文件加载中...</p>}
      {!documentsLoading && documents.length === 0 && <p className="text-sm text-muted-foreground">当前项目还没有上传文件。</p>}
      {documents.map((document) => (
        <div key={document.id} className="rounded-[24px] border border-border/80 bg-background/80 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-foreground">{document.originalName}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {document.role} · {document.pageCount} 页 · {formatDocumentParseMethodLabel(document.parseMethod)}
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 whitespace-nowrap">
              {document.parseStatus}
            </Badge>
          </div>
          <p className="mt-4 rounded-[18px] border border-border/70 bg-background/88 p-4 text-sm leading-7 text-muted-foreground">
            {document.textPreview || "暂无解析摘要"}
          </p>
        </div>
      ))}
    </CardContent>
  </Card>
);

export default ProjectDocumentsCard;
