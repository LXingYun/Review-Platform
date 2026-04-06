import { useState } from "react";
import { Search, Filter, Download, Eye, CheckCircle2, AlertTriangle, XCircle, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Issue {
  id: number;
  title: string;
  project: string;
  risk: "高" | "中" | "低";
  category: string;
  location: string;
  status: "待复核" | "已确认" | "已忽略";
  description: string;
}

const issues: Issue[] = [
  { id: 1, title: "投标保证金比例超出法定上限", project: "XX市政工程", risk: "高", category: "资金条款", location: "第3章 第2.1节", status: "待复核", description: "投标保证金要求为项目估算价的3%，超出《招标投标法实施条例》规定的2%上限。" },
  { id: 2, title: "评标标准设置不合理", project: "XX市政工程", risk: "高", category: "评标办法", location: "第5章 第1.3节", status: "待复核", description: "技术评分中对特定品牌设备给予额外加分，涉嫌排斥潜在投标人。" },
  { id: 3, title: "工期要求与工程量不匹配", project: "医疗设备采购", risk: "中", category: "合同条款", location: "第4章 第3节", status: "已确认", description: "合同要求30天内完成安装调试，但设备清单包含大型影像设备，通常需要60天。" },
  { id: 4, title: "资质要求层级偏高", project: "智慧城市项目", risk: "中", category: "资格条件", location: "第2章 第1节", status: "待复核", description: "要求投标人具有特级资质，但项目规模仅需一级资质即可满足。" },
  { id: 5, title: "付款条件存在风险", project: "高速公路建设", risk: "低", category: "合同条款", location: "第6章 第4.2节", status: "已忽略", description: "预付款比例为10%，低于行业惯例但不违反法规。" },
  { id: 6, title: "投标文件格式要求过于严苛", project: "学校建设工程", risk: "低", category: "投标须知", location: "第1章 第5节", status: "已确认", description: "要求投标文件必须使用特定软件生成，可能限制部分投标人参与。" },
];

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

const Results = () => {
  const [search, setSearch] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  const filtered = issues.filter(
    (i) => i.title.includes(search) || i.project.includes(search) || i.category.includes(search)
  );

  const highCount = issues.filter((i) => i.risk === "高").length;
  const midCount = issues.filter((i) => i.risk === "中").length;
  const lowCount = issues.filter((i) => i.risk === "低").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">审查结果</h1>
          <p className="text-muted-foreground mt-1">查看所有审查发现的问题，支持人工复核</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          导出报告
        </Button>
      </div>

      {/* Risk summary */}
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

      {/* Search & Tabs */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索问题..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-1" /> 筛选
        </Button>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">全部 ({issues.length})</TabsTrigger>
          <TabsTrigger value="pending">待复核</TabsTrigger>
          <TabsTrigger value="confirmed">已确认</TabsTrigger>
          <TabsTrigger value="ignored">已忽略</TabsTrigger>
        </TabsList>

        {["all", "pending", "confirmed", "ignored"].map((tab) => {
          const statusMap: Record<string, string | null> = { all: null, pending: "待复核", confirmed: "已确认", ignored: "已忽略" };
          const tabFiltered = filtered.filter((i) => !statusMap[tab] || i.status === statusMap[tab]);
          const grouped = tabFiltered.reduce<Record<string, Issue[]>>((acc, issue) => {
            (acc[issue.project] ??= []).push(issue);
            return acc;
          }, {});

          return (
            <TabsContent key={tab} value={tab} className="mt-4 space-y-4">
              {Object.keys(grouped).length === 0 ? (
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
                              <Badge variant={riskBadge(issue.risk)}>{issue.risk}风险</Badge>
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

      {/* Issue Detail Dialog */}
      <Dialog open={!!selectedIssue} onOpenChange={() => setSelectedIssue(null)}>
        <DialogContent className="max-w-lg">
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
                  <Badge variant={riskBadge(selectedIssue.risk)}>{selectedIssue.risk}风险</Badge>
                  <Badge variant="outline">{selectedIssue.category}</Badge>
                  <Badge variant="outline">{selectedIssue.status}</Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">原文定位</Label>
                  <p className="text-sm mt-1 p-3 rounded-lg bg-muted">{selectedIssue.location} — {selectedIssue.project}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">问题描述</Label>
                  <p className="text-sm mt-1 text-foreground">{selectedIssue.description}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">复核备注</Label>
                  <Textarea placeholder="输入复核意见..." className="mt-1" />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1">
                    <CheckCircle2 className="h-4 w-4 mr-1" /> 确认问题
                  </Button>
                  <Button variant="outline" className="flex-1">忽略</Button>
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
