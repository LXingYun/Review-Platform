import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, BookOpen, ChevronRight, Pencil, Trash2, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { RegulationDraft, RegulationItem } from "@/lib/api-types";

const categoryColor = (category: string) => {
  if (category === "法律") return "bg-primary/10 text-primary border-primary/20";
  if (category === "行政法规") return "bg-accent/10 text-accent border-accent/20";
  if (category === "演示法规") return "bg-warning/10 text-warning border-warning/20";
  return "bg-muted text-muted-foreground border-border";
};

const Regulations = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("法律");
  const [updated, setUpdated] = useState("");
  const [textPreview, setTextPreview] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<RegulationDraft | null>(null);
  const [editingRegulationId, setEditingRegulationId] = useState<string | null>(null);

  const { data: regulations = [], isLoading, isError } = useQuery({
    queryKey: ["regulations", search],
    queryFn: () => apiRequest<RegulationItem[]>(`/regulations?search=${encodeURIComponent(search)}`),
  });

  const createRegulationMutation = useMutation({
    mutationFn: () =>
      apiRequest<RegulationItem>("/regulations", {
        method: "POST",
        body: JSON.stringify({
          name,
          category,
          updated: updated || "手动录入",
          ruleCount: 1,
          textPreview,
          chunks: [
            {
              id: `manual-${Date.now()}`,
              order: 1,
              text: textPreview || `${name}（手动录入，暂无条款摘要）`,
            },
          ],
          sections: [
            {
              title: "手动录入",
              rules: 1,
            },
          ],
        }),
      }),
    onSuccess: () => {
      setOpen(false);
      setName("");
      setCategory("法律");
      setUpdated("");
      setTextPreview("");
      queryClient.invalidateQueries({ queryKey: ["regulations"] });
    },
  });

  const deleteRegulationMutation = useMutation({
    mutationFn: (regulationId: string) =>
      apiRequest<{ success: boolean; regulationId: string }>(`/regulations/${regulationId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regulations"] });
    },
  });

  const uploadRegulationMutation = useMutation({
    mutationFn: () => {
      if (!uploadFile) {
        throw new Error("请先选择法规文件");
      }

      const formData = new FormData();
      formData.append("file", uploadFile);

      return apiRequest<RegulationDraft>("/regulations/upload/preview", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: (preview) => {
      const initialSectionTitle = preview.sections[0]?.title ?? "自动识别条款";
      setDraft({
        ...preview,
        chunks: preview.chunks.map((chunk) => ({
          ...chunk,
          sectionId: initialSectionTitle,
        })),
      });
    },
  });

  const confirmDraftMutation = useMutation({
    mutationFn: (payload: RegulationDraft) =>
      apiRequest<RegulationItem>(editingRegulationId ? `/regulations/${editingRegulationId}` : "/regulations", {
        method: editingRegulationId ? "PUT" : "POST",
        body: JSON.stringify({
          ...payload,
          chunks: payload.chunks.map(({ sectionId, ...chunk }) => ({
            ...chunk,
            sectionTitle: sectionId,
          })),
        }),
      }),
    onSuccess: () => {
      setDraft(null);
      setEditingRegulationId(null);
      setUploadOpen(false);
      setUploadFile(null);
      queryClient.invalidateQueries({ queryKey: ["regulations"] });
    },
  });

  const normalizedDraft = useMemo(() => draft, [draft]);

  const updateDraftChunks = (chunks: RegulationDraft["chunks"]) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            chunks,
            ruleCount: chunks.length,
            sections: current.sections.map((section, index) => ({
              ...section,
              rules:
                chunks.filter((chunk) => (chunk.sectionId ?? current.sections[0]?.title) === section.title).length ||
                (index === 0 ? chunks.filter((chunk) => !chunk.sectionId).length : 0),
            })),
          }
        : current,
    );
  };

  const updateDraftSections = (sections: RegulationDraft["sections"]) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            sections: sections.map((section) => ({
              ...section,
              rules: current.chunks.filter((chunk) => (chunk.sectionId ?? current.sections[0]?.title) === section.title).length,
            })),
          }
        : current,
    );
  };

  const moveDraftChunk = (fromIndex: number, toIndex: number) => {
    if (!normalizedDraft) return;
    if (toIndex < 0 || toIndex >= normalizedDraft.chunks.length) return;

    const nextChunks = [...normalizedDraft.chunks];
    const [moved] = nextChunks.splice(fromIndex, 1);
    nextChunks.splice(toIndex, 0, moved);

    updateDraftChunks(nextChunks.map((item, index) => ({ ...item, order: index + 1 })));
  };

  return (
    <div className="space-y-8 pb-8">
      <div className="surface-paper flex flex-col gap-6 rounded-[34px] px-6 py-8 md:px-8 md:py-9 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">法规与规则管理</h1>
          <p className="mt-1 text-muted-foreground">管理审查依赖的法规、规则和支撑材料</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                上传法规文件
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl">
              <DialogHeader>
                <DialogTitle>上传法规文件</DialogTitle>
                <DialogDescription>支持 PDF、文本和图片类法规文件，系统会自动识别文本并整理入库。</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>法规文件</Label>
                  <Input
                    type="file"
                    accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp"
                    className="mt-2"
                    onChange={(e) => {
                      setUploadFile(e.target.files?.[0] ?? null);
                      setDraft(null);
                    }}
                  />
                </div>

                {normalizedDraft && (
                  <div className="space-y-4 rounded-[24px] border border-stone-200/90 bg-white/74 p-5">
                    {normalizedDraft.aiRefined?.applied && (
                      <div className="rounded-[18px] border border-primary/20 bg-primary/5 p-4 text-sm">
                        <p className="font-medium text-foreground">AI 已辅助精修本次法规草稿</p>
                        <p className="mt-1 text-muted-foreground">
                          重点优化字段：
                          {normalizedDraft.aiRefined.changedFields.length > 0
                            ? ` ${normalizedDraft.aiRefined.changedFields.join("、")}`
                            : " 无明显字段调整"}
                        </p>
                      </div>
                    )}

                    <div>
                      <Label>法规名称</Label>
                      <Input
                        className="mt-2"
                        value={normalizedDraft.name}
                        onChange={(e) => setDraft((current) => (current ? { ...current, name: e.target.value } : current))}
                      />
                    </div>

                    <div>
                      <Label>法规分类</Label>
                      <Input
                        className="mt-2"
                        value={normalizedDraft.category}
                        onChange={(e) => setDraft((current) => (current ? { ...current, category: e.target.value } : current))}
                      />
                    </div>

                    <div>
                      <Label>更新时间</Label>
                      <Input
                        className="mt-2"
                        value={normalizedDraft.updated}
                        onChange={(e) => setDraft((current) => (current ? { ...current, updated: e.target.value } : current))}
                      />
                    </div>

                    <div>
                      <Label>摘要</Label>
                      <Textarea
                        className="mt-2"
                        value={normalizedDraft.textPreview}
                        onChange={(e) => setDraft((current) => (current ? { ...current, textPreview: e.target.value } : current))}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <Label>章节结构</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateDraftSections([
                              ...normalizedDraft.sections,
                              {
                                title: `新章节 ${normalizedDraft.sections.length + 1}`,
                                rules: 0,
                              },
                            ])
                          }
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          新增章节
                        </Button>
                      </div>

                      <div className="mt-2 space-y-2">
                        {normalizedDraft.sections.map((section, index) => (
                          <div key={`${section.title}-${index}`} className="rounded-[18px] border border-stone-200/90 bg-white/82 p-4">
                            <div className="flex items-center gap-2">
                              <Input
                                value={section.title}
                                onChange={(e) =>
                                  updateDraftSections(
                                    normalizedDraft.sections.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, title: e.target.value } : item,
                                    ),
                                  )
                                }
                              />
                              <Input
                                className="w-28"
                                value={String(section.rules)}
                                onChange={(e) =>
                                  updateDraftSections(
                                    normalizedDraft.sections.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            rules: Number.isNaN(Number(e.target.value)) ? 0 : Number(e.target.value),
                                          }
                                        : item,
                                    ),
                                  )
                                }
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  updateDraftSections(normalizedDraft.sections.filter((_, itemIndex) => itemIndex !== index))
                                }
                                disabled={normalizedDraft.sections.length === 1}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>条款条目</Label>
                      <div className="mt-2 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateDraftChunks([
                              ...(normalizedDraft?.chunks ?? []),
                              {
                                id: `manual-chunk-${Date.now()}`,
                                order: (normalizedDraft?.chunks.length ?? 0) + 1,
                                text: "",
                                sectionId: normalizedDraft.sections[0]?.title,
                              },
                            ])
                          }
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          新增条目
                        </Button>
                      </div>
                      <div className="mt-2 max-h-72 space-y-2 overflow-auto">
                        {normalizedDraft.chunks.map((chunk, index) => (
                          <div key={chunk.id} className="rounded-[18px] border border-stone-200/90 bg-white/82 p-4">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-xs text-muted-foreground">条目 {index + 1}</p>
                              <div className="flex gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => moveDraftChunk(index, index - 1)} disabled={index === 0}>
                                  上移
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => moveDraftChunk(index, index + 1)}
                                  disabled={index === normalizedDraft.chunks.length - 1}
                                >
                                  下移
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const nextChunks = normalizedDraft.chunks
                                      .filter((_, itemIndex) => itemIndex !== index)
                                      .map((item, itemIndex) => ({ ...item, order: itemIndex + 1 }));
                                    updateDraftChunks(nextChunks);
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  删除条目
                                </Button>
                              </div>
                            </div>
                            <Textarea
                              value={chunk.text}
                              onChange={(e) =>
                                updateDraftChunks(
                                  normalizedDraft.chunks.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, text: e.target.value } : item,
                                  ),
                                )
                              }
                            />
                            <div className="mt-2">
                              <Label className="text-xs text-muted-foreground">所属章节</Label>
                              <select
                                className="mt-1 w-full rounded-[18px] border border-stone-300 bg-white/78 px-4 py-2.5 text-sm"
                                value={chunk.sectionId ?? normalizedDraft.sections[0]?.title ?? ""}
                                onChange={(e) =>
                                  updateDraftChunks(
                                    normalizedDraft.chunks.map((item, itemIndex) =>
                                      itemIndex === index ? { ...item, sectionId: e.target.value } : item,
                                    ),
                                  )
                                }
                              >
                                {normalizedDraft.sections.map((section) => (
                                  <option key={section.title} value={section.title}>
                                    {section.title}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                {!normalizedDraft ? (
                  <Button onClick={() => uploadRegulationMutation.mutate()} disabled={!uploadFile || uploadRegulationMutation.isPending}>
                    {uploadRegulationMutation.isPending ? "识别中..." : "上传并识别"}
                  </Button>
                ) : (
                  <Button onClick={() => confirmDraftMutation.mutate(normalizedDraft)} disabled={confirmDraftMutation.isPending}>
                    {confirmDraftMutation.isPending ? "保存中..." : "确认入库"}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                添加法规
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加法规</DialogTitle>
                <DialogDescription>先支持手动录入基础法规摘要，后续可替换为正式导入。</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>法规名称</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="输入法规名称" className="mt-1" />
                </div>
                <div>
                  <Label>法规分类</Label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="如：法律 / 行政法规 / 部门规章" className="mt-1" />
                </div>
                <div>
                  <Label>更新时间</Label>
                  <Input value={updated} onChange={(e) => setUpdated(e.target.value)} placeholder="如：2024-01-01 或 手动录入" className="mt-1" />
                </div>
                <div>
                  <Label>条款摘要</Label>
                  <Textarea value={textPreview} onChange={(e) => setTextPreview(e.target.value)} placeholder="输入可用于审查的基础条款摘要" className="mt-1" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createRegulationMutation.mutate()} disabled={!name || !textPreview || createRegulationMutation.isPending}>
                  {createRegulationMutation.isPending ? "保存中..." : "保存法规"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="搜索法规..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">法规加载中...</p>}
      {isError && <p className="text-sm text-destructive">法规数据加载失败</p>}

      <div className="space-y-4">
        {regulations.map((regulation) => (
          <Card key={regulation.id} className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,242,233,0.88))]">
            <CardContent className="p-0">
              <Accordion type="single" collapsible>
                <AccordionItem value={`reg-${regulation.id}`} className="border-0">
                  <AccordionTrigger className="px-5 py-4 hover:no-underline">
                    <div className="flex w-full items-center justify-between gap-3 pr-2 text-left">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-stone-200 bg-white/90 text-stone-800">
                          <BookOpen className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">{regulation.name}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={`text-xs ${categoryColor(regulation.category)}`}>
                              {regulation.category}
                            </Badge>
                            {regulation.category === "演示法规" && <Badge variant="outline">Demo</Badge>}
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
                              disabled={deleteRegulationMutation.isPending}
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
                                onClick={() => deleteRegulationMutation.mutate(regulation.id)}
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
                            setEditingRegulationId(regulation.id);
                            setUploadOpen(true);
                            setDraft({
                              name: regulation.name,
                              category: regulation.category,
                              ruleCount: regulation.ruleCount,
                              updated: regulation.updated,
                              textPreview: regulation.textPreview,
                              sections: regulation.sections,
                              chunks: regulation.chunks.map((chunk) => ({
                                ...chunk,
                                sectionId: chunk.sectionTitle ?? regulation.sections[0]?.title,
                              })),
                            });
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
                        <div key={`${regulation.id}-${section.title}`} className="rounded-[18px] border border-stone-200/90 bg-white/82 p-4">
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
                                <div key={chunk.id} className="rounded-[16px] border border-stone-200/80 bg-stone-50/85 p-4">
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
    </div>
  );
};

export default Regulations;
