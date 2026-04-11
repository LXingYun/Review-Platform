import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { RegulationDraft, RegulationItem } from "@/lib/api-types";
import {
  useCreateRegulationMutation,
  useDeleteRegulationMutation,
  usePreviewRegulationUploadMutation,
  useRegulationsQuery,
  useSaveRegulationDraftMutation,
} from "@/hooks/queries";
import CreateRegulationDialog from "./CreateRegulationDialog";
import RegulationList from "./RegulationList";
import RegulationUploadDialog from "./RegulationUploadDialog";

const RegulationsPageContainer = () => {
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

  const { data: regulations = [], isLoading, isError } = useRegulationsQuery(search);

  const createRegulationMutation = useCreateRegulationMutation({
    onSuccess: () => {
      setOpen(false);
      setName("");
      setCategory("法律");
      setUpdated("");
      setTextPreview("");
    },
  });

  const deleteRegulationMutation = useDeleteRegulationMutation();

  const uploadRegulationMutation = usePreviewRegulationUploadMutation({
    onSuccess: (preview) => {
      const initialSectionTitle = preview.sections[0]?.title ?? "自动识别条款";
      setDraft({
        ...preview,
        chunks: preview.chunks.map((chunk) => ({
          ...chunk,
          sectionId: chunk.sectionId ?? chunk.sectionTitle ?? initialSectionTitle,
        })),
      });
    },
  });

  const resetUploadDraftState = () => {
    setDraft(null);
    setEditingRegulationId(null);
    setUploadFile(null);
  };

  const buildDraftWithSectionsAndChunks = (
    current: RegulationDraft,
    nextSections: RegulationDraft["sections"],
    nextChunks: RegulationDraft["chunks"],
  ): RegulationDraft => ({
    ...current,
    chunks: nextChunks,
    ruleCount: nextChunks.length,
    sections: nextSections.map((section, index) => ({
      ...section,
      rules:
        nextChunks.filter((chunk) => (chunk.sectionId ?? nextSections[0]?.title) === section.title).length ||
        (index === 0 ? nextChunks.filter((chunk) => !chunk.sectionId).length : 0),
    })),
  });

  const confirmDraftMutation = useSaveRegulationDraftMutation({
    onSuccess: () => {
      setUploadOpen(false);
      resetUploadDraftState();
    },
  });

  const normalizedDraft = draft;

  const updateDraftChunks = (chunks: RegulationDraft["chunks"]) => {
    setDraft((current) =>
      current
        ? buildDraftWithSectionsAndChunks(current, current.sections, chunks)
        : current,
    );
  };

  const updateDraftSections = (sections: RegulationDraft["sections"]) => {
    setDraft((current) =>
      current
        ? buildDraftWithSectionsAndChunks(current, sections, current.chunks)
        : current,
    );
  };

  const updateDraftSectionTitle = (index: number, value: string) => {
    setDraft((current) => {
      if (!current) return current;

      const previousTitle = current.sections[index]?.title;
      const nextSections = current.sections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, title: value } : section,
      );
      const nextChunks = previousTitle
        ? current.chunks.map((chunk) =>
            chunk.sectionId === previousTitle ? { ...chunk, sectionId: value } : chunk,
          )
        : current.chunks;

      return buildDraftWithSectionsAndChunks(current, nextSections, nextChunks);
    });
  };

  const removeDraftSection = (index: number) => {
    setDraft((current) => {
      if (!current || current.sections.length === 1) return current;

      const removedTitle = current.sections[index]?.title;
      const nextSections = current.sections.filter((_, sectionIndex) => sectionIndex !== index);
      const fallbackSectionTitle = nextSections[index]?.title ?? nextSections[nextSections.length - 1]?.title;
      const nextChunks = removedTitle
        ? current.chunks.map((chunk) =>
            chunk.sectionId === removedTitle ? { ...chunk, sectionId: fallbackSectionTitle } : chunk,
          )
        : current.chunks;

      return buildDraftWithSectionsAndChunks(current, nextSections, nextChunks);
    });
  };

  const moveDraftChunk = (fromIndex: number, toIndex: number) => {
    if (!normalizedDraft) return;
    if (toIndex < 0 || toIndex >= normalizedDraft.chunks.length) return;

    const nextChunks = [...normalizedDraft.chunks];
    const [moved] = nextChunks.splice(fromIndex, 1);
    nextChunks.splice(toIndex, 0, moved);

    updateDraftChunks(nextChunks.map((item, index) => ({ ...item, order: index + 1 })));
  };

  const handleCreateRegulation = () => {
    createRegulationMutation.mutate({
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
    });
  };

  const handlePreviewUpload = () => {
    if (!uploadFile) return;
    uploadRegulationMutation.mutate(uploadFile);
  };

  const handleConfirmDraft = () => {
    if (!normalizedDraft) return;
    confirmDraftMutation.mutate({ draft: normalizedDraft, regulationId: editingRegulationId });
  };

  const handleUploadOpenChange = (nextOpen: boolean) => {
    setUploadOpen(nextOpen);
    if (!nextOpen) {
      resetUploadDraftState();
    }
  };

  const handleEditRegulation = (regulation: RegulationItem) => {
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
  };

  return (
    <div className="space-y-8 pb-8">
      <div className="surface-paper flex flex-col gap-6 rounded-[34px] px-6 py-8 md:px-8 md:py-9 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">法规与规则管理</h1>
          <p className="mt-1 text-muted-foreground">管理审查依赖的法规、规则和支持材料</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RegulationUploadDialog
            open={uploadOpen}
            uploadFile={uploadFile}
            draft={normalizedDraft}
            previewPending={uploadRegulationMutation.isPending}
            confirmPending={confirmDraftMutation.isPending}
            onOpenChange={handleUploadOpenChange}
            onUploadFileChange={(file) => {
              setUploadFile(file);
              setDraft(null);
            }}
            onPreviewUpload={handlePreviewUpload}
            onConfirmDraft={handleConfirmDraft}
            onNameChange={(value) => setDraft((current) => (current ? { ...current, name: value } : current))}
            onCategoryChange={(value) => setDraft((current) => (current ? { ...current, category: value } : current))}
            onUpdatedChange={(value) => setDraft((current) => (current ? { ...current, updated: value } : current))}
            onTextPreviewChange={(value) => setDraft((current) => (current ? { ...current, textPreview: value } : current))}
            onAddSection={() =>
              normalizedDraft &&
              updateDraftSections([
                ...normalizedDraft.sections,
                {
                  title: `新章节 ${normalizedDraft.sections.length + 1}`,
                  rules: 0,
                },
              ])
            }
            onUpdateSectionTitle={(index, value) =>
              normalizedDraft &&
              updateDraftSectionTitle(index, value)
            }
            onRemoveSection={(index) => normalizedDraft && removeDraftSection(index)}
            onAddChunk={() =>
              normalizedDraft &&
              updateDraftChunks([
                ...normalizedDraft.chunks,
                {
                  id: `manual-chunk-${Date.now()}`,
                  order: normalizedDraft.chunks.length + 1,
                  text: "",
                  sectionId: normalizedDraft.sections[0]?.title,
                },
              ])
            }
            onMoveChunk={moveDraftChunk}
            onRemoveChunk={(index) => {
              if (!normalizedDraft) return;
              const nextChunks = normalizedDraft.chunks
                .filter((_, itemIndex) => itemIndex !== index)
                .map((item, itemIndex) => ({ ...item, order: itemIndex + 1 }));
              updateDraftChunks(nextChunks);
            }}
            onUpdateChunkText={(index, value) =>
              normalizedDraft &&
              updateDraftChunks(
                normalizedDraft.chunks.map((item, itemIndex) => (itemIndex === index ? { ...item, text: value } : item)),
              )
            }
            onUpdateChunkSection={(index, value) =>
              normalizedDraft &&
              updateDraftChunks(
                normalizedDraft.chunks.map((item, itemIndex) => (itemIndex === index ? { ...item, sectionId: value } : item)),
              )
            }
          />

          <CreateRegulationDialog
            open={open}
            name={name}
            category={category}
            updated={updated}
            textPreview={textPreview}
            isPending={createRegulationMutation.isPending}
            onOpenChange={setOpen}
            onNameChange={setName}
            onCategoryChange={setCategory}
            onUpdatedChange={setUpdated}
            onTextPreviewChange={setTextPreview}
            onCreate={handleCreateRegulation}
          />
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="搜索法规..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">法规加载中...</p>}
      {isError && <p className="text-sm text-destructive">法规数据加载失败</p>}

      <RegulationList
        regulations={regulations}
        isDeleting={deleteRegulationMutation.isPending}
        onDeleteRegulation={(regulationId) => deleteRegulationMutation.mutate(regulationId)}
        onEditRegulation={handleEditRegulation}
      />
    </div>
  );
};

export default RegulationsPageContainer;
