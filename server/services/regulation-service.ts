import { store } from "../store";
import { Regulation } from "../types";
import { createId, normalizeUploadedFileName } from "../utils";
import { getAiConfig } from "./ai-config-service";
import { requestStructuredAiReview } from "./ai-client-service";
import { parseDocumentBuffer } from "./document-parse-service";
import { z } from "zod";

export interface RegulationDraft {
  name: string;
  category: string;
  ruleCount: number;
  updated: string;
  textPreview: string;
  chunks: Regulation["chunks"];
  sections: Regulation["sections"];
  aiRefined?: {
    applied: boolean;
    changedFields: string[];
  };
}

const aiRegulationDraftSchema = z.object({
  name: z.string(),
  category: z.string(),
  updated: z.string(),
  textPreview: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      rules: z.number(),
    }),
  ).min(1),
  chunks: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      order: z.number(),
      sectionTitle: z.string().optional(),
    }),
  ).min(1),
});

const inferRegulationTitle = (fallbackName: string, chunks: Regulation["chunks"]) => {
  const candidates = chunks.slice(0, 5).map((chunk) => chunk.text);

  for (const text of candidates) {
    const matched = text.match(/《[^》]{2,60}》/);
    if (matched) return matched[0];
  }

  for (const text of candidates) {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (normalized.length >= 6 && normalized.length <= 60) {
      return normalized;
    }
  }

  return fallbackName;
};

const inferRegulationCategory = (text: string) => {
  if (text.includes("法实施条例") || text.includes("条例")) return "行政法规";
  if (text.includes("规定") || text.includes("办法") || text.includes("细则")) return "部门规章";
  if (text.includes("法")) return "法律";
  return "上传法规";
};

const inferUpdatedLabel = (text: string) => {
  const matched = text.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!matched) return "文件导入";

  const [, year, month, day] = matched;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const inferSectionTitle = (category: string) => {
  if (category === "法律") return "法条摘要";
  if (category === "行政法规") return "条例摘要";
  if (category === "部门规章") return "规定摘要";
  return "自动识别条款";
};

export const listRegulations = (search?: string) => {
  const data = store.get();
  const keyword = search?.trim();

  return data.regulations.filter((regulation) => {
    if (!keyword) return true;
    return regulation.name.includes(keyword) || regulation.category.includes(keyword);
  });
};

export const createRegulation = (input: Omit<Regulation, "id">) => {
  const regulation: Regulation = {
    ...input,
    id: createId("reg"),
    textPreview: input.textPreview,
    chunks: input.chunks,
  };

  store.update((current) => ({
    ...current,
    regulations: [regulation, ...current.regulations],
  }));

  return regulation;
};

export const updateRegulation = (regulationId: string, input: Omit<Regulation, "id">) => {
  const current = store.get();
  const regulation = current.regulations.find((item) => item.id === regulationId);

  if (!regulation) {
    throw new Error("法规不存在");
  }

  const nextRegulation: Regulation = {
    ...input,
    id: regulationId,
  };

  store.update((state) => ({
    ...state,
    regulations: state.regulations.map((item) =>
      item.id === regulationId ? nextRegulation : item,
    ),
  }));

  return nextRegulation;
};

export const deleteRegulation = (regulationId: string) => {
  const current = store.get();
  const regulation = current.regulations.find((item) => item.id === regulationId);

  if (!regulation) {
    throw new Error("法规不存在");
  }

  store.update((state) => ({
    ...state,
    regulations: state.regulations.filter((item) => item.id !== regulationId),
  }));

  return { success: true, regulationId };
};

const buildRegulationDraftFromFile = async (file: Express.Multer.File): Promise<RegulationDraft> => {
  const rawName = normalizeUploadedFileName(file.originalname).replace(/\.[^.]+$/, "");
  const parsed = await parseDocumentBuffer({
    originalName: file.originalname,
    mimeType: file.mimetype || "application/octet-stream",
    fileBuffer: file.buffer,
  });

  const title = inferRegulationTitle(rawName, parsed.chunks);
  const category = inferRegulationCategory(parsed.extractedText || rawName);
  const updated = inferUpdatedLabel(parsed.extractedText);

  return {
    name: title,
    category,
    ruleCount: Math.max(parsed.chunks.length, 1),
    updated,
    textPreview: parsed.textPreview,
    chunks: parsed.chunks.map((chunk, index) => ({
      ...chunk,
      id: `${title}-chunk-${index + 1}`,
    })),
    sections: [
      {
        title: inferSectionTitle(category),
        rules: Math.max(parsed.chunks.length, 1),
      },
    ],
    aiRefined: {
      applied: false,
      changedFields: [],
    },
  };
};

const refineDraftWithAi = async (draft: RegulationDraft) => {
  const aiConfig = getAiConfig();
  if (!aiConfig.enabled) return draft;

  const refined = aiRegulationDraftSchema.parse(
    await requestStructuredAiReview<unknown>({
      systemPrompt: [
        "你是法规知识库整理助手。",
        "你的任务是基于已解析的法规草稿，优化法规名称、分类、日期、摘要、section 标题以及条款归属。",
        "你只能依据输入草稿中的信息调整，不得编造未出现的法律名称、发布日期或条文。",
        "如果无法判断，就保留原草稿，不要杜撰。",
        "只返回合法 JSON。",
      ].join("\n"),
      userPrompt: JSON.stringify({
        draft,
        requirements: {
          categoryExamples: ["法律", "行政法规", "部门规章", "上传法规"],
          goals: [
            "尽量提取正式法规名称",
            "尽量归纳更准确的 section 标题",
            "让条款归属到更合适的 section",
            "不要改变条款核心内容",
          ],
        },
      }),
    }),
  );

  const nextDraft: RegulationDraft = {
    name: refined.name,
    category: refined.category,
    updated: refined.updated,
    textPreview: refined.textPreview,
    ruleCount: refined.chunks.length,
    chunks: refined.chunks.map((chunk) => ({
      ...chunk,
      sectionTitle: chunk.sectionTitle,
    })),
    sections: refined.sections.map((section) => ({
      ...section,
      rules: refined.chunks.filter((chunk) => (chunk.sectionTitle ?? refined.sections[0]?.title) === section.title).length,
    })),
  };

  const changedFields: string[] = [];
  if (draft.name !== nextDraft.name) changedFields.push("法规名称");
  if (draft.category !== nextDraft.category) changedFields.push("法规分类");
  if (draft.updated !== nextDraft.updated) changedFields.push("更新时间");
  if (draft.textPreview !== nextDraft.textPreview) changedFields.push("摘要");
  if (JSON.stringify(draft.sections) !== JSON.stringify(nextDraft.sections)) changedFields.push("章节结构");
  if (JSON.stringify(draft.chunks) !== JSON.stringify(nextDraft.chunks)) changedFields.push("条款条目");

  return {
    ...nextDraft,
    aiRefined: {
      applied: true,
      changedFields,
    },
  };
};

export const importRegulationFromFile = async (file: Express.Multer.File) => {
  const draft = await buildRegulationDraftFromFile(file);

  const regulation: Regulation = {
    id: createId("reg"),
    ...draft,
  };

  store.update((current) => ({
    ...current,
    regulations: [regulation, ...current.regulations],
  }));

  return regulation;
};

export const previewRegulationFromFile = async (file: Express.Multer.File) => {
  const draft = await buildRegulationDraftFromFile(file);
  return refineDraftWithAi(draft).catch(() => draft);
};
