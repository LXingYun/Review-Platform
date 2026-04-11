import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const processSteps = [
  {
    step: "01",
    title: "归档资料",
    description: "先选项目，再上传招标文件、投标文件或补充材料。",
  },
  {
    step: "02",
    title: "AI 智能审查",
    description: "系统自动解析文档并比对法规，快速定位潜在风险点。",
  },
  {
    step: "03",
    title: "人工高效复核",
    description: "查看 AI 提示的风险项，进行确认、备注或修改，得出最终审查结论。",
  },
];

const DashboardUsageGuide = () => (
  <Card className="surface-panel h-full border-border/80 bg-card/85">
    <CardHeader className="pb-5">
      <CardTitle className="font-display text-[30px] text-foreground">使用方法</CardTitle>
      <CardDescription>把上传、AI 审查和人工复核串成一条连续的工作流，减少来回切换成本。</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {processSteps.map((item) => (
        <div key={item.step} className="rounded-[24px] border border-border/80 bg-background/78 p-4">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-sm font-semibold text-foreground">
              {item.step}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </div>
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

export default DashboardUsageGuide;
