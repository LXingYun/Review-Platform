import { useState } from "react";
import { Search, Plus, BookOpen, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const regulations = [
  {
    id: 1,
    name: "《中华人民共和国招标投标法》",
    category: "法律",
    ruleCount: 68,
    updated: "2023-12-28",
    sections: [
      { title: "第一章 总则", rules: 8 },
      { title: "第二章 招标", rules: 15 },
      { title: "第三章 投标", rules: 12 },
      { title: "第四章 开标、评标和中标", rules: 18 },
      { title: "第五章 法律责任", rules: 15 },
    ],
  },
  {
    id: 2,
    name: "《招标投标法实施条例》",
    category: "行政法规",
    ruleCount: 85,
    updated: "2019-03-02",
    sections: [
      { title: "第一章 总则", rules: 6 },
      { title: "第二章 招标", rules: 22 },
      { title: "第三章 投标", rules: 16 },
      { title: "第四章 评标与中标", rules: 20 },
    ],
  },
  {
    id: 3,
    name: "《政府采购法》",
    category: "法律",
    ruleCount: 79,
    updated: "2014-08-31",
    sections: [
      { title: "第一章 总则", rules: 10 },
      { title: "第二章 采购当事人", rules: 14 },
      { title: "第三章 采购方式", rules: 12 },
    ],
  },
  {
    id: 4,
    name: "《工程建设项目施工招标投标办法》",
    category: "部门规章",
    ruleCount: 52,
    updated: "2013-05-01",
    sections: [
      { title: "第一章 总则", rules: 5 },
      { title: "第二章 招标", rules: 18 },
      { title: "第三章 投标", rules: 15 },
    ],
  },
];

const categoryColor = (cat: string) => {
  if (cat === "法律") return "bg-primary/10 text-primary border-primary/20";
  if (cat === "行政法规") return "bg-accent/10 text-accent border-accent/20";
  return "bg-muted text-muted-foreground border-border";
};

const Regulations = () => {
  const [search, setSearch] = useState("");

  const filtered = regulations.filter((r) => r.name.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">法规与规则管理</h1>
          <p className="text-muted-foreground mt-1">管理审查所依据的法律法规与自定义规则</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          添加法规
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="搜索法规..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="space-y-4">
        {filtered.map((reg) => (
          <Card key={reg.id} className="border border-border shadow-sm">
            <CardContent className="p-0">
              <Accordion type="single" collapsible>
                <AccordionItem value={`reg-${reg.id}`} className="border-0">
                  <AccordionTrigger className="px-5 py-4 hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-sm">{reg.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={`text-xs ${categoryColor(reg.category)}`}>
                            {reg.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{reg.ruleCount} 条规则</span>
                          <span className="text-xs text-muted-foreground">更新于 {reg.updated}</span>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-4">
                    <div className="space-y-2 ml-12">
                      {reg.sections.map((section, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                        >
                          <span className="text-sm text-foreground">{section.title}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{section.rules} 条</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Regulations;
