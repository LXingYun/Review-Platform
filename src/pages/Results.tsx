import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Search, Filter, Download, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { API_BASE_URL, apiRequest } from "@/lib/api";
import { FindingListItem } from "@/lib/api-types";
import { useToast } from "@/hooks/use-toast";

const riskIcon = (risk: string) => {
  if (risk === "高") return <XCircle className="h-4 w-4 text-destructive" />;
  if (risk === "中") return <AlertTriangle className="h-4 w-4 text-warning" />;
  return <CheckCircle2 className="h-4 w-4 text-success" />;
};

const riskBadge = (risk: string) => {
  if (risk === "高") return "destructive" as const;
  if (risk === "中") return "secondary" as const;
  return "outline" as const;
};

const reviewStageLabel = (stage: FindingListItem["reviewStage"]) => {
  if (stage === "cross_section_review") return "跨章节冲突";
  if (stage === "response_consistency_review") return "响应一致性";
  return "章节审查";
};

const ChunkGroup = ({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; text: string }>;
}) => {
  if (items.length === 0) return null;

  return (
    <div>
      <Label className="text-xs text-muted-foreground">{title}</Label>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div key={`${title}-${item.label}-${item.text}`} className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            <p className="text-sm text-foreground mt-1">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const Results = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<FindingListItem | null>(null);
  const [humanReviewFilter, setHumanReviewFilter] = useState<"all" | "needs_review" | "no_review">("all");
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | "ge_80" | "ge_60" | "lt_60">("all");

  const projectId = searchParams.get("projectId") ?? "";
  const scenario = searchParams.get("scenario") ?? "";
  const taskId = searchParams.get("taskId") ?? "";

  const findingsQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (projectId) params.set("projectId", projectId);
    if (scenario) params.set("scenario", scenario);
    return params.toString();
  }, [projectId, scenario, search]);

  const { data: issues = [], isLoading, isError } = useQuery({
    queryKey: ["findings", search, projectId, scenario],
    queryFn: () => apiRequest<FindingListItem[]>(`/findings${findingsQuery ? `?${findingsQuery}` : ""}`),
  });

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (humanReviewFilter === "needs_review" && !issue.needsHumanReview) return false;
      if (humanReviewFilter === "no_review" && issue.needsHumanReview) return false;

      if (confidenceFilter === "ge_80" && issue.confidence < 0.8) return false;
      if (confidenceFilter === "ge_60" && issue.confidence < 0.6) return false;
      if (confidenceFilter === "lt_60" && issue.confidence >= 0.6) return false;

      return true;
    });
  }, [issues, humanReviewFilter, confidenceFilter]);

  const updateFindingMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "待复核" | "已确认" | "已忽略" }) =>
      apiRequest<FindingListItem>(`/findings/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (finding) => {
      setSelectedIssue(null);
      queryClient.invalidateQueries({ queryKey: ["findings"] });
      toast({
        title: "状态已更新",
        description: `问题已标记为${finding.status}。`,
      });
    },
    onError: (error) => {
      toast({
        title: "更新失败",
        description: error instanceof Error ? error.message : "请稍后重试。",
        variant: "destructive",
      });
    },
  });

  const highCount = filteredIssues.filter((i) => i.risk === "高").length;
  const midCount = filteredIssues.filter((i) => i.risk === "中").length;
  const lowCount = filteredIssues.filter((i) => i.risk === "低").length;

  const reportUrl = taskId
    ? `${API_BASE_URL}/review-tasks/${taskId}/formal-report`
    : `${API_BASE_URL}/findings/export/formal-html${findingsQuery ? `?${findingsQuery}` : ""}`;

  const handleViewReport = () => {
    if (!taskId) {
      toast({
        title: "缺少任务上下文",
        description: "请从任务详情页进入结果页后查看正式报告。",
        variant: "destructive",
      });
      return;
    }
    window.open(reportUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">审查结果</h1>
          <p className="text-muted-foreground mt-1">查看所有审查发现的问题，支持人工复核</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleViewReport} disabled={!taskId}>
            <Download className="h-4 w-4 mr-2" />
            查看报告
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold text-destructive">{highCount}</p>
              <p className="text-sm text-muted-foreground">高风险</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-warning" />
            <div>
              <p className="text-2xl font-bold text-warning">{midCount}</p>
              <p className="text-sm text-muted-foreground">中风险</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-success/20 bg-success/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-success" />
            <div>
              <p className="text-2xl font-bold text-success">{lowCount}</p>
              <p className="text-sm text-muted-foreground">低风险</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索问题..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-1" /> 筛选
        </Button>
        <Select value={humanReviewFilter} onValueChange={(value) => setHumanReviewFilter(value as typeof humanReviewFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="人工复核筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部复核状态</SelectItem>
            <SelectItem value="needs_review">仅需人工复核</SelectItem>
            <SelectItem value="no_review">仅无需人工复核</SelectItem>
          </SelectContent>
        </Select>
        <Select value={confidenceFilter} onValueChange={(value) => setConfidenceFilter(value as typeof confidenceFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="置信度筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部置信度</SelectItem>
            <SelectItem value="ge_80">80%以上</SelectItem>
            <SelectItem value="ge_60">60%以上</SelectItem>
            <SelectItem value="lt_60">60%以下</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(projectId || scenario || humanReviewFilter !== "all" || confidenceFilter !== "all") && (
        <div className="flex flex-wrap gap-2">
          {projectId && <Badge variant="outline">项目筛选中</Badge>}
          {scenario && <Badge variant="outline">场景: {scenario === "tender_compliance" ? "招标审查" : "投标审查"}</Badge>}
          {humanReviewFilter === "needs_review" && <Badge variant="outline">仅看需人工复核</Badge>}
          {humanReviewFilter === "no_review" && <Badge variant="outline">仅看无需人工复核</Badge>}
          {confidenceFilter === "ge_80" && <Badge variant="outline">置信度 80% 以上</Badge>}
          {confidenceFilter === "ge_60" && <Badge variant="outline">置信度 60% 以上</Badge>}
          {confidenceFilter === "lt_60" && <Badge variant="outline">置信度 60% 以下</Badge>}
        </div>
      )}

      {isError && <p className="text-sm text-destructive">问题数据加载失败</p>}

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">全部 ({filteredIssues.length})</TabsTrigger>
          <TabsTrigger value="cross">跨章节冲突</TabsTrigger>
          <TabsTrigger value="pending">待复核</TabsTrigger>
          <TabsTrigger value="confirmed">已确认</TabsTrigger>
          <TabsTrigger value="ignored">已忽略</TabsTrigger>
        </TabsList>

        {["all", "cross", "pending", "confirmed", "ignored"].map((tab) => {
          const statusMap: Record<string, string | null> = {
            all: null,
            cross: null,
            pending: "待复核",
            confirmed: "已确认",
            ignored: "已忽略",
          };

          const tabFiltered = filteredIssues.filter((issue) => {
            if (tab === "cross" && issue.reviewStage !== "cross_section_review") return false;
            return !statusMap[tab] || issue.status === statusMap[tab];
          });
          const grouped = tabFiltered.reduce<Record<string, FindingListItem[]>>((acc, issue) => {
            (acc[issue.project] ??= []).push(issue);
            return acc;
          }, {});

          return (
            <TabsContent key={tab} value={tab} className="mt-4 space-y-4">
              {isLoading && <p className="text-sm text-muted-foreground p-4">问题加载中...</p>}
              {!isLoading && Object.keys(grouped).length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">暂无数据</p>
              ) : (
                Object.entries(grouped).map(([project, projectIssues]) => (
                  <Card key={project} className="border border-border shadow-sm">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-base font-semibold flex items-center justify-between">
                        <span>{project}</span>
                        <Badge variant="outline" className="text-xs font-normal">{projectIssues.length} 个问题</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-border">
                        {projectIssues.map((issue) => (
                          <div
                            key={issue.id}
                            className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => setSelectedIssue(issue)}
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              {riskIcon(issue.risk)}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground">{issue.title}</p>
                                <span className="text-xs text-muted-foreground">{issue.location}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <Badge variant="outline">{reviewStageLabel(issue.reviewStage)}</Badge>
                              <Badge variant={riskBadge(issue.risk)}>{issue.risk}风险</Badge>
                              {issue.needsHumanReview && <Badge variant="outline">需复核</Badge>}
                              <Badge variant="outline" className="text-xs">{issue.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <Dialog open={!!selectedIssue} onOpenChange={() => setSelectedIssue(null)}>
        <DialogContent className="max-w-4xl">
          {selectedIssue && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {riskIcon(selectedIssue.risk)}
                  {selectedIssue.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{reviewStageLabel(selectedIssue.reviewStage)}</Badge>
                  <Badge variant={riskBadge(selectedIssue.risk)}>{selectedIssue.risk}风险</Badge>
                  <Badge variant="outline">{selectedIssue.category}</Badge>
                  <Badge variant="outline">{selectedIssue.status}</Badge>
                  <Badge variant="outline">置信度 {Math.round(selectedIssue.confidence * 100)}%</Badge>
                  {selectedIssue.needsHumanReview && <Badge variant="outline">建议人工复核</Badge>}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">原文定位</Label>
                  <p className="text-sm mt-1 p-3 rounded-lg bg-muted">{selectedIssue.location} - {selectedIssue.project}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">问题描述</Label>
                  <p className="text-sm mt-1 text-foreground">{selectedIssue.description}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">处理建议</Label>
                  <p className="text-sm mt-1 text-foreground">{selectedIssue.recommendation}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">引用依据</Label>
                  <div className="mt-2 space-y-2">
                    {selectedIssue.references.map((reference) => (
                      <p key={reference} className="text-sm rounded-lg bg-muted px-3 py-2">
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
                    label: `${chunk.regulationName} [${chunk.regulationCategory}]${chunk.sectionTitle ? ` · ${chunk.sectionTitle}` : ""} · 条款片段 ${chunk.order}`,
                    text: chunk.text,
                  }))}
                />
                <div>
                  <Label className="text-xs text-muted-foreground">复核备注</Label>
                  <Textarea placeholder="输入复核意见..." className="mt-1" />
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={updateFindingMutation.isPending}
                    onClick={() =>
                      updateFindingMutation.mutate({ id: selectedIssue.id, status: "已确认" })
                    }
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" /> 确认问题
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={updateFindingMutation.isPending}
                    onClick={() =>
                      updateFindingMutation.mutate({ id: selectedIssue.id, status: "已忽略" })
                    }
                  >
                    忽略
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Results;
