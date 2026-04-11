import { BookOpen, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { RegulationItem } from "@/lib/api-types";

interface RegulationListProps {
  regulations: RegulationItem[];
  isDeleting: boolean;
  onDeleteRegulation: (regulationId: string) => void;
  onEditRegulation: (regulation: RegulationItem) => void;
}

const categoryColor = (category: string) => {
  if (category === "法律") return "bg-primary/10 text-primary border-primary/20";
  if (category === "行政法规") return "bg-accent/10 text-accent border-accent/20";
  if (category === "演示法规") return "bg-warning/10 text-warning border-warning/20";
  return "bg-muted text-muted-foreground border-border";
};

const RegulationList = ({
  regulations,
  isDeleting,
  onDeleteRegulation,
  onEditRegulation,
}: RegulationListProps) => (
  <div className="space-y-4">
    {regulations.map((regulation) => (
      <Card key={regulation.id} className="surface-panel overflow-hidden border-border/80 bg-card/90">
        <CardContent className="p-0">
          <Accordion type="single" collapsible>
            <AccordionItem value={`reg-${regulation.id}`} className="border-0">
              <AccordionTrigger className="px-5 py-4 hover:bg-background/35 hover:no-underline">
                <div className="flex w-full items-center justify-between gap-3 pr-2 text-left">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-border/80 bg-background/80 text-primary">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{regulation.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${categoryColor(regulation.category)}`}>
                          {regulation.category}
                        </Badge>
                        {regulation.category === "演示法规" && <Badge variant="outline">示例</Badge>}
                        <span className="text-xs text-muted-foreground">{regulation.ruleCount} 条规则</span>
                        <span className="text-xs text-muted-foreground">更新于 {regulation.updated}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-full"
                          onClick={(e) => e.stopPropagation()}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>删除法规？</AlertDialogTitle>
                          <AlertDialogDescription>删除后该法规将不再参与后续审查候选匹配。</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDeleteRegulation(regulation.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            确认删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditRegulation(regulation);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-4">
                <div className="ml-12 space-y-3">
                  <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{regulation.textPreview || "暂无摘要"}</p>
                  {regulation.sections.map((section) => (
                    <div key={`${regulation.id}-${section.title}`} className="rounded-[18px] border border-border/80 bg-background/75 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{section.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{section.rules} 条</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {regulation.chunks
                          .filter((chunk) => (chunk.sectionTitle ?? regulation.sections[0]?.title) === section.title)
                          .map((chunk) => (
                            <div key={chunk.id} className="rounded-[16px] border border-border/70 bg-background/85 p-4">
                              <p className="text-xs text-muted-foreground">片段 {chunk.order}</p>
                              <p className="mt-1 text-sm text-foreground">{chunk.text}</p>
                            </div>
                          ))}
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
);

export default RegulationList;
