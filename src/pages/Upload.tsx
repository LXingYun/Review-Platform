import { useState, useCallback } from "react";
import {
  Upload as UploadIcon,
  FileText,
  X,
  CheckCircle2,
  Loader2,
  FileSearch,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface UploadedFile {
  id: number;
  name: string;
  size: string;
  status: "uploading" | "parsing" | "done";
}

type ReviewType = "bid" | "tender" | null;
type Step = "select" | "upload-bid" | "upload-tender-bid" | "upload-tender-tender";

const Upload = () => {
  const [reviewType, setReviewType] = useState<ReviewType>(null);
  const [step, setStep] = useState<Step>("select");
  const [dragActive, setDragActive] = useState(false);
  const [bidFiles, setBidFiles] = useState<UploadedFile[]>([]);
  const [tenderFiles, setTenderFiles] = useState<UploadedFile[]>([]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const addMockFile = (
    setter: React.Dispatch<React.SetStateAction<UploadedFile[]>>,
    label: string
  ) => {
    const newFile: UploadedFile = {
      id: Date.now(),
      name: `${label}_${Date.now()}.pdf`,
      size: `${(Math.random() * 15 + 1).toFixed(1)} MB`,
      status: "uploading",
    };
    setter((prev) => [newFile, ...prev]);
    setTimeout(() => {
      setter((prev) =>
        prev.map((f) => (f.id === newFile.id ? { ...f, status: "parsing" } : f))
      );
    }, 1500);
    setTimeout(() => {
      setter((prev) =>
        prev.map((f) => (f.id === newFile.id ? { ...f, status: "done" } : f))
      );
    }, 3500);
  };

  const removeFile = (
    setter: React.Dispatch<React.SetStateAction<UploadedFile[]>>,
    id: number
  ) => setter((prev) => prev.filter((f) => f.id !== id));

  const statusBadge = (status: UploadedFile["status"]) => {
    if (status === "uploading")
      return (
        <Badge variant="secondary">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          上传中
        </Badge>
      );
    if (status === "parsing")
      return (
        <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          解析中
        </Badge>
      );
    return (
      <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        已完成
      </Badge>
    );
  };

  const handleSelectType = () => {
    if (!reviewType) return;
    if (reviewType === "bid") {
      setStep("upload-bid");
    } else {
      setStep("upload-tender-bid");
    }
  };

  const handleBack = () => {
    if (step === "upload-bid" || step === "upload-tender-bid") {
      setStep("select");
      setReviewType(null);
      setBidFiles([]);
      setTenderFiles([]);
    } else if (step === "upload-tender-tender") {
      setStep("upload-tender-bid");
    }
  };

  const allDone = (files: UploadedFile[]) =>
    files.length > 0 && files.every((f) => f.status === "done");

  const renderDropZone = (
    setter: React.Dispatch<React.SetStateAction<UploadedFile[]>>,
    label: string,
    files: UploadedFile[]
  ) => (
    <div className="space-y-4">
      <Card
        className={`border-2 border-dashed transition-colors cursor-pointer ${
          dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={(e) => {
          handleDrag(e);
          addMockFile(setter, label);
        }}
        onClick={() => addMockFile(setter, label)}
      >
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="p-4 rounded-full bg-primary/10 mb-4">
            <UploadIcon className="h-8 w-8 text-primary" />
          </div>
          <p className="text-foreground font-medium">拖拽文件至此处或点击上传</p>
          <p className="text-sm text-muted-foreground mt-1">
            支持 PDF、Word、Excel 格式，单文件最大 50MB
          </p>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">已上传文件</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{file.size}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(file.status)}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(setter, file.id);
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Step 1: Select review type
  if (step === "select") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">文件审查</h1>
          <p className="text-muted-foreground mt-1">请选择您要审查的文件类型</p>
        </div>

        <div className="max-w-xl mx-auto mt-8">
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-primary" />
                选择审查类型
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup
                value={reviewType ?? ""}
                onValueChange={(v) => setReviewType(v as ReviewType)}
                className="space-y-3"
              >
                <label
                  className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    reviewType === "bid"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value="bid" className="mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">审查招标文件</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      上传招标文件，系统将自动审查其合规性、条款完整性等
                    </p>
                  </div>
                </label>
                <label
                  className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    reviewType === "tender"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value="tender" className="mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">审查投标文件</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      需先上传招标文件作为参照，再上传投标文件进行对比审查
                    </p>
                  </div>
                </label>
              </RadioGroup>

              <Button
                className="w-full"
                disabled={!reviewType}
                onClick={handleSelectType}
              >
                下一步
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 2a: Upload bid document (for bid review)
  if (step === "upload-bid") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">审查招标文件</h1>
            <p className="text-muted-foreground mt-1">请上传需要审查的招标文件</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {renderDropZone(setBidFiles, "招标文件", bidFiles)}
          </div>
          <div>
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">审查说明</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted space-y-1">
                  <p className="font-medium text-foreground mb-1">系统将自动检查</p>
                  <ul className="space-y-1">
                    <li>• 招标文件格式与完整性</li>
                    <li>• 条款合规性审查</li>
                    <li>• 评分标准合理性</li>
                    <li>• 资质要求合法性</li>
                    <li>• 关键时间节点校验</li>
                  </ul>
                </div>
                <Button className="w-full" disabled={!allDone(bidFiles)}>
                  开始审查
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Step 2b: Upload bid document first (for tender review)
  if (step === "upload-tender-bid") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">审查投标文件</h1>
            <p className="text-muted-foreground mt-1">
              第 1 步：请先上传招标文件作为审查参照
            </p>
          </div>
          <Badge variant="outline" className="ml-auto text-xs">
            步骤 1/2
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {renderDropZone(setBidFiles, "招标文件", bidFiles)}
          </div>
          <div>
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">流程说明</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    1
                  </div>
                  <p className="text-sm font-medium text-foreground">上传招标文件</p>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <div className="h-6 w-6 rounded-full bg-muted-foreground/20 text-muted-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    2
                  </div>
                  <p className="text-sm text-muted-foreground">上传投标文件</p>
                </div>
                <Button
                  className="w-full"
                  disabled={!allDone(bidFiles)}
                  onClick={() => setStep("upload-tender-tender")}
                >
                  下一步
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Upload tender document
  if (step === "upload-tender-tender") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">审查投标文件</h1>
            <p className="text-muted-foreground mt-1">
              第 2 步：请上传需要审查的投标文件
            </p>
          </div>
          <Badge variant="outline" className="ml-auto text-xs">
            步骤 2/2
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {renderDropZone(setTenderFiles, "投标文件", tenderFiles)}
          </div>
          <div className="space-y-4">
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">流程说明</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
                  <div className="h-6 w-6 rounded-full bg-success text-success-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    ✓
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">招标文件已上传</p>
                    <p className="text-xs text-muted-foreground">
                      {bidFiles.length} 个文件
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    2
                  </div>
                  <p className="text-sm font-medium text-foreground">上传投标文件</p>
                </div>
                <Button className="w-full" disabled={!allDone(tenderFiles)}>
                  开始审查
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default Upload;
