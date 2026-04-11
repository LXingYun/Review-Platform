import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { RegulationDraft } from "@/lib/api-types";

interface RegulationDraftEditorProps {
  draft: RegulationDraft;
  onNameChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onUpdatedChange: (value: string) => void;
  onTextPreviewChange: (value: string) => void;
  onAddSection: () => void;
  onUpdateSectionTitle: (index: number, value: string) => void;
  onRemoveSection: (index: number) => void;
  onAddChunk: () => void;
  onMoveChunk: (fromIndex: number, toIndex: number) => void;
  onRemoveChunk: (index: number) => void;
  onUpdateChunkText: (index: number, value: string) => void;
  onUpdateChunkSection: (index: number, value: string) => void;
}

const RegulationDraftEditor = ({
  draft,
  onNameChange,
  onCategoryChange,
  onUpdatedChange,
  onTextPreviewChange,
  onAddSection,
  onUpdateSectionTitle,
  onRemoveSection,
  onAddChunk,
  onMoveChunk,
  onRemoveChunk,
  onUpdateChunkText,
  onUpdateChunkSection,
}: RegulationDraftEditorProps) => (
  <div className="space-y-4 rounded-[24px] border border-border/80 bg-card/82 p-5">
    {draft.aiRefined?.applied && (
      <div className="rounded-[18px] border border-primary/20 bg-primary/5 p-4 text-sm">
        <p className="font-medium text-foreground">AI 已辅助精修本次法规草稿</p>
        <p className="mt-1 text-muted-foreground">
          重点优化字段：
          {draft.aiRefined.changedFields.length > 0 ? ` ${draft.aiRefined.changedFields.join("、")}` : " 无明显字段调整"}
        </p>
      </div>
    )}

    <div>
      <Label>法规名称</Label>
      <Input className="mt-2" value={draft.name} onChange={(e) => onNameChange(e.target.value)} />
    </div>

    <div>
      <Label>法规分类</Label>
      <Input className="mt-2" value={draft.category} onChange={(e) => onCategoryChange(e.target.value)} />
    </div>

    <div>
      <Label>更新时间</Label>
      <Input className="mt-2" value={draft.updated} onChange={(e) => onUpdatedChange(e.target.value)} />
    </div>

    <div>
      <Label>摘要</Label>
      <Textarea className="mt-2" value={draft.textPreview} onChange={(e) => onTextPreviewChange(e.target.value)} />
    </div>

    <div>
      <div className="flex items-center justify-between">
        <Label>章节结构</Label>
        <Button type="button" variant="outline" size="sm" onClick={onAddSection}>
          <Plus className="mr-2 h-4 w-4" />
          新增章节
        </Button>
      </div>

      <div className="mt-2 space-y-2">
        {draft.sections.map((section, index) => (
          <div key={`${section.title}-${index}`} className="rounded-[18px] border border-border/80 bg-background/80 p-4">
            <div className="flex items-center gap-2">
              <Input value={section.title} onChange={(e) => onUpdateSectionTitle(index, e.target.value)} />
              <div className="flex h-10 w-28 items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
                {section.rules} 条
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onRemoveSection(index)}
                disabled={draft.sections.length === 1}
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
        <Button type="button" variant="outline" size="sm" onClick={onAddChunk}>
          <Plus className="mr-2 h-4 w-4" />
          新增条目
        </Button>
      </div>
      <div className="mt-2 max-h-72 space-y-2 overflow-auto">
        {draft.chunks.map((chunk, index) => (
          <div key={chunk.id} className="rounded-[18px] border border-border/80 bg-background/80 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">条目 {index + 1}</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => onMoveChunk(index, index - 1)} disabled={index === 0}>
                  上移
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onMoveChunk(index, index + 1)}
                  disabled={index === draft.chunks.length - 1}
                >
                  下移
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => onRemoveChunk(index)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除条目
                </Button>
              </div>
            </div>
            <Textarea value={chunk.text} onChange={(e) => onUpdateChunkText(index, e.target.value)} />
            <div className="mt-2">
              <Label className="text-xs text-muted-foreground">所属章节</Label>
              <select
                className="mt-1 w-full rounded-[18px] border border-border bg-background px-4 py-2.5 text-sm"
                value={chunk.sectionId ?? draft.sections[0]?.title ?? ""}
                onChange={(e) => onUpdateChunkSection(index, e.target.value)}
              >
                {draft.sections.map((section) => (
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
);

export default RegulationDraftEditor;
