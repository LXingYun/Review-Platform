import { useState, useCallback } from "react";
import { Upload as UploadIcon, FileText, X, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface UploadedFile {
  id: number;
  name: string;
  size: string;
  status: "uploading" | "parsing" | "done";
  type: string;
}

const Upload = () => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([
    { id: 1, name: "招标文件_XX市政工程.pdf", size: "12.4 MB", status: "done", type: "招标文件" },
    { id: 2, name: "投标文件_公司A.pdf", size: "8.7 MB", status: "done", type: "投标文件" },
    { id: 3, name: "资质证明材料.pdf", size: "3.2 MB", status: "parsing", type: "资质文件" },
  ]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const addMockFile = () => {
    const newFile: UploadedFile = {
      id: Date.now(),
      name: `文件_${Date.now()}.pdf`,
      size: "5.1 MB",
      status: "uploading",
      type: "招标文件",
    };
    setFiles((prev) => [newFile, ...prev]);
    setTimeout(() => {
      setFiles((prev) => prev.map((f) => (f.id === newFile.id ? { ...f, status: "parsing" } : f)));
    }, 1500);
    setTimeout(() => {
      setFiles((prev) => prev.map((f) => (f.id === newFile.id ? { ...f, status: "done" } : f)));
    }, 3500);
  };

  const removeFile = (id: number) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const statusBadge = (status: UploadedFile["status"]) => {
    if (status === "uploading") return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />上传中</Badge>;
    if (status === "parsing") return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20"><Loader2 className="h-3 w-3 mr-1 animate-spin" />解析中</Badge>;
    return <Badge variant="secondary" className="bg-success/10 text-success border-success/20"><CheckCircle2 className="h-3 w-3 mr-1" />已完成</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">文件上传</h1>
        <p className="text-muted-foreground mt-1">上传招标/投标文件，系统将自动解析文档内容</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Drop zone */}
          <Card
            className={`border-2 border-dashed transition-colors cursor-pointer ${
              dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={(e) => { handleDrag(e); addMockFile(); }}
            onClick={addMockFile}
          >
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <UploadIcon className="h-8 w-8 text-primary" />
              </div>
              <p className="text-foreground font-medium">拖拽文件至此处或点击上传</p>
              <p className="text-sm text-muted-foreground mt-1">支持 PDF、Word、Excel 格式，单文件最大 50MB</p>
            </CardContent>
          </Card>

          {/* File list */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">已上传文件</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {files.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">暂无上传文件</p>
              )}
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{file.size} · {file.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(file.status)}
                    <button onClick={() => removeFile(file.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Parsing options */}
        <div>
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">解析设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">文件类型</Label>
                <Select defaultValue="bid">
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bid">招标文件</SelectItem>
                    <SelectItem value="tender">投标文件</SelectItem>
                    <SelectItem value="qualification">资质文件</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">解析模式</Label>
                <Select defaultValue="auto">
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自动识别</SelectItem>
                    <SelectItem value="ocr">OCR 模式</SelectItem>
                    <SelectItem value="text">纯文本模式</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted">
                <p className="font-medium text-foreground mb-1">解析能力</p>
                <ul className="space-y-1">
                  <li>• PDF 文本与表格提取</li>
                  <li>• OCR 图片文字识别</li>
                  <li>• 章节与条款自动分割</li>
                  <li>• 关键信息智能提取</li>
                </ul>
              </div>
              <Button className="w-full">开始审查</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Upload;
