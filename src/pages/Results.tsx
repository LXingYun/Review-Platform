import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Download, Filter, Search, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL, apiRequest } from "@/lib/api";
import { FindingListItem, ProjectListItem } from "@/lib/api-types";
import { useToast } from "@/hooks/use-toast";

const ALL_PROJECTS = "__all_projects__";

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
            <p className="mt-1 text-sm text-foreground">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const Results = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<FindingListItem | null>(null);
  const [humanReviewFilter, setHumanReviewFilter] = useState<"all" | "needs_review" | "no_review">("all");
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | "ge_80" | "ge_60" | "lt_60">("all");

  const projectId = searchParams.get("projectId") ?? "";
  const scenario = searchParams.get("scenario") ?? "";
  const taskId = searchParams.get("taskId") ?? "";
  const selectedProjectValue = projectId || ALL_PROJECTS;

  const updateSearchParams = (updates: Record<string, string | null>) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);

      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          next.set(key, value);
          return;
        }

        next.delete(key);
      });

      return next;
    });
  };

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "results"],
    queryFn: () => apiRequest<ProjectListItem[]>("/projects"),
  });

  const selectedProject = projects.find((project) => project.id === projectId) ?? null;

  useEffect(() => {
    if (!projectId || projects.length === 0 || selectedProject) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("projectId");
      next.delete("taskId");
      return next;
    });
  }, [projectId, projects.length, selectedProject, setSearchParams]);

  const findingsQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (projectId) params.set("projectId", projectId);
    if (scenario) params.set("scenario", scenario);
    return params.toString();
  }, [projectId, scenario, search]);

  const { data: issues = [], isLoading, isError } = useQuery({
    queryKey: ["findings", findingsQuery],
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

  const highCount = filteredIssues.filter((issue) => issue.risk === "高").length;
  const midCount = filteredIssues.filter((issue) => issue.risk === "中").length;
  const lowCount = filteredIssues.filter((issue) => issue.risk === "低").length;

  const reportUrl = taskId
    ? `${API_BASE_URL}/review-tasks/${taskId}/formal-report`
    : `${API_BASE_URL}/findings/export/formal-html${findingsQuery ? `?${findingsQuery}` : ""}`;

  const reportButtonLabel = taskId ? "查看正式报告" : projectId ? "查看项目报告" : "查看汇总报告";

  const handleProjectChange = (value: string) => {
    updateSearchParams({
      projectId: value === ALL_PROJECTS ? null : value,
      taskId: null,
    });
  };

  const handleViewReport = () => {
    window.open(reportUrl, "_blank", "noopener,noreferrer");
  };

  const renderIssueRow = (issue: FindingListItem) => (
    <div
      key={issue.id}
      className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-muted/50"
      onClick={() => setSelectedIssue(issue)}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {riskIcon(issue.risk)}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{issue.title}</p>
          <span className="text-xs text-muted-foreground">{issue.location}</span>
        </div>
      </div>
      <div className="ml-4 flex items-center gap-2">
        <Badge variant="outline">{reviewStageLabel(issue.reviewStage)}</Badge>
        <Badge variant={riskBadge(issue.risk)}>{issue.risk}风险</Badge>
        {issue.needsHumanReview && <Badge variant="outline">需复核</Badge>}
        <Badge variant="outline" className="text-xs">
          {issue.status}
        </Badge>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">审查结果</h1>
          <p className="mt-1 text-muted-foreground">
            {selectedProject
              ? `当前查看 ${selectedProject.name} 的问题清单、审查状态与报告输出`
              : "按项目查看问题清单、审查状态与正式报告"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleViewReport}>
            <Download className="mr-2 h-4 w-4" />
            {reportButtonLabel}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4">
            <XCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold text-destructive">{highCount}</p>
              <p className="text-sm text-muted-foreground">高风险</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-8 w-8 text-warning" />
            <div>
              <p className="text-2xl font-bold text-warning">{midCount}</p>
              <p className="text-sm text-muted-foreground">中风险</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-success/20 bg-success/5">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-8 w-8 text-success" />
            <div>
              <p className="text-2xl font-bold text-success">{lowCount}</p>
              <p className="text-sm text-muted-foreground">低风险</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedProjectValue} onValueChange={handleProjectChange}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="选择项目" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PROJECTS}>全部项目</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索问题..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-10"
          />
        </div>

        <Button variant="outline" size="sm">
          <Filter className="mr-1 h-4 w-4" />
          筛选
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

      {(selectedProject || scenario || humanReviewFilter !== "all" || confidenceFilter !== "all") && (
        <div className="flex flex-wrap gap-2">
          {selectedProject && <Badge variant="outline">项目: {selectedProject.name}</Badge>}
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

          const groupedIssues = tabFiltered.reduce<Record<string, FindingListItem[]>>((acc, issue) => {
            (acc[issue.project] ??= []).push(issue);
            return acc;
          }, {});

          return (
            <TabsContent key={tab} value={tab} className="mt-4 space-y-4">
              {isLoading && <p className="p-4 text-sm text-muted-foreground">问题加载中...</p>}

              {!isLoading && tabFiltered.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">暂无数据</p>
              ) : projectId ? (
                <Card className="border border-border shadow-sm">
                  <CardHeader className="px-4 pb-2 pt-4">
                    <CardTitle className="flex items-center justify-between text-base font-semibold">
                      <span>{selectedProject?.name ?? "当前项目"}</span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {tabFiltered.length} 个问题
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">{tabFiltered.map(renderIssueRow)}</div>
                  </CardContent>
                </Card>
              ) : (
                Object.entries(groupedIssues).map(([project, projectIssues]) => (
                  <Card key={project} className="border border-border shadow-sm">
                    <CardHeader className="px-4 pb-2 pt-4">
                      <CardTitle className="flex items-center justify-between text-base font-semibold">
                        <span>{project}</span>
                        <Badge variant="outline" className="text-xs font-normal">
                          {projectIssues.length} 个问题
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-border">{projectIssues.map(renderIssueRow)}</div>
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
                  <p className="mt-1 rounded-lg bg-muted p-3 text-sm">
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
                      <p key={reference} className="rounded-lg bg-muted px-3 py-2 text-sm">
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
                    onClick={() => updateFindingMutation.mutate({ id: selectedIssue.id, status: "已确认" })}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    确认问题
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={updateFindingMutation.isPending}
                    onClick={() => updateFindingMutation.mutate({ id: selectedIssue.id, status: "已忽略" })}
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
