import { z } from "zod";
import { requestStructuredAiReview } from "./ai-client-service";
import { matchRegulationChunks } from "./regulation-match-service";
import { createId, nowIso } from "../utils";
import { DocumentChunk, DocumentRecord, Finding, Regulation, TenderFindingCategory } from "../types";

interface TenderChapter {
  id: string;
  title: string;
  text: string;
  chunks: DocumentChunk[];
  pageRange: string;
}

const tenderCategoryEnum = z.enum([
  "资格条件",
  "评标办法",
  "保证金条款",
  "商务条款",
  "技术条款",
  "时间节点",
  "文件完整性",
  "其他",
]);

const chapterReviewSchema = z.object({
  chapter_title: z.string(),
  summary: z.string(),
  findings: z.array(
    z.object({
      title: z.string(),
      category: tenderCategoryEnum,
      risk: z.enum(["高", "中", "低"]),
      description: z.string(),
      recommendation: z.string(),
      references: z.array(z.string()).default([]),
      sourceChunkIds: z.array(z.string()).default([]),
      regulationChunkIds: z.array(z.string()).default([]),
      needsHumanReview: z.boolean().default(true),
      confidence: z.number().min(0).max(1).default(0.5),
    }),
  ),
});

const crossScanSchema = z.object({
  conflicts: z.array(
    z.object({
      title: z.string(),
      risk: z.enum(["高", "中", "低"]),
      description: z.string(),
      recommendation: z.string(),
      chapterA: z.string(),
      chapterB: z.string(),
      references: z.array(z.string()).default([]),
      sourceChunkIds: z.array(z.string()).default([]),
      needsHumanReview: z.boolean().default(true),
      confidence: z.number().min(0).max(1).default(0.5),
    }),
  ),
  summary: z.string().default(""),
});

const CHAPTER_TITLE_PATTERNS = [
  /第[一二三四五六七八九十百\d]+章[^。\n]{0,50}/,
  /第[一二三四五六七八九十百\d]+节[^。\n]{0,40}/,
  /第[一二三四五六七八九十百\d]+条[^。\n]{0,40}/,
  /[一二三四五六七八九十]+、[^。\n]{0,40}/,
  /\d+[、.．][^。\n]{0,40}/,
  /(投标人须知|评标办法|合同条款|招标公告|技术要求|技术标准|工程量清单|资格审查|商务条款|投标文件格式)/,
];

const normalizeTitle = (text: string) => text.replace(/\s+/g, " ").trim();

const isTocNoise = (text: string) => {
  const normalized = normalizeTitle(text);
  if (normalized.length < 4) return true;
  if (normalized.includes("目录") && normalized.length <= 12) return true;
  if (/\.{3,}\s*\d+$/.test(normalized)) return true;
  if (/^\d+$/.test(normalized)) return true;
  return false;
};

const extractChapterTitle = (text: string) => {
  for (const pattern of CHAPTER_TITLE_PATTERNS) {
    const match = text.match(pattern);
    if (!match?.[0]) continue;
    const normalized = normalizeTitle(match[0]);
    if (isTocNoise(normalized)) continue;
    return normalized;
  }

  return null;
};

export const extractTenderChapters = (document: DocumentRecord): TenderChapter[] => {
  if (document.chunks.length === 0) return [];

  const totalChunks = Math.max(document.chunks.length, 1);
  const estimatePage = (chunkOrder: number) => Math.max(1, Math.ceil((chunkOrder / totalChunks) * document.pageCount));

  const chapters: TenderChapter[] = [];
  let current: TenderChapter | null = null;

  document.chunks.forEach((chunk, index) => {
    const title = extractChapterTitle(chunk.text);

    if (!current || title) {
      if (current) chapters.push(current);

      current = {
        id: `${document.id}-chapter-${index + 1}`,
        title: title ?? `文档片段组 ${chapters.length + 1}`,
        text: chunk.text,
        chunks: [chunk],
        pageRange: `第 ${estimatePage(chunk.order)} 页`,
      };
      return;
    }

    current.text += `\n${chunk.text}`;
    current.chunks.push(chunk);
  });

  if (current) chapters.push(current);

  return chapters.filter((chapter) => !isTocNoise(chapter.title));
};

const buildRegulationCandidatesForChapter = (chapter: TenderChapter, regulations: Regulation[]) => {
  const candidates = chapter.chunks.flatMap((chunk) =>
    matchRegulationChunks({
      sourceChunk: chunk,
      regulations,
      preferredKeywords: ["保证金", "资格", "资质", "评标", "评分", "限制", "排斥", "工期", "合同", "技术"],
      limit: 2,
    }),
  );

  const unique = new Map<string, (typeof candidates)[number]>();
  candidates.forEach((candidate) => {
    const key = `${candidate.regulation.id}:${candidate.chunk.id}`;
    if (!unique.has(key)) unique.set(key, candidate);
  });

  return Array.from(unique.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((candidate) => ({
      regulationName: candidate.regulation.name,
      regulationCategory: candidate.regulation.category,
      sectionTitle: candidate.chunk.sectionTitle,
      chunkId: candidate.chunk.id,
      text: candidate.chunk.text,
      matchedKeywords: candidate.matchedKeywords,
    }));
};

const buildChapterMetadataSummary = (document: DocumentRecord) => ({
  filename: document.originalName,
  pageCount: document.pageCount,
  textPreview: document.textPreview,
  topChunks: document.chunks.slice(0, 5).map((chunk) => ({
    id: chunk.id,
    order: chunk.order,
    text: chunk.text,
  })),
});

const reviewTenderChapter = async (chapter: TenderChapter, document: DocumentRecord, regulations: Regulation[]) => {
  const regulationCandidates = buildRegulationCandidatesForChapter(chapter, regulations);

  return chapterReviewSchema.parse(
    await requestStructuredAiReview<unknown>({
      systemPrompt: [
        "你是建设工程与政府采购领域的招标文件章节审查助手，同时具备招投标审计、造价工程、法律合规三方面经验。",
        "你的核心原则是：证据优先、结论审慎、引用原文、保留不确定性。",
        "你的任务是只针对当前章节进行综合初审，从法律合规、造价风控、项目管理三个维度识别潜在问题。",
        "你必须重点关注以下风险：资格条件设置是否过高或过低、是否存在排斥潜在投标人的条件、评标办法或评分因素是否模糊或倾向性过强、保证金和工期及最高限价是否明显不合理、风险分配和费用承担是否存在争议、是否存在单方面不平等权利、是否存在时间节点冲突、占位符、空缺项、未明确字段和明显逻辑矛盾。",
        "禁止行为：不能把当前章节未见写成整份文件缺失；不能在证据不足时直接下违法、无效、重大缺陷等重结论；不能编造页码、条款编号、法律依据或外部事实；不能输出空泛风险话术；不能为了凑数量输出问题。",
        "风险分级规则：高风险=存在明显违法违规风险、明显限制竞争风险、重大履约或投诉风险；中风险=存在较明显争议、条款不合理、条件偏高、逻辑不清、需重点人工复核；低风险=轻微瑕疵、一般提醒、表述不清或证据不足以认定严重问题。",
        "category 只能从：资格条件、评标办法、保证金条款、商务条款、技术条款、时间节点、文件完整性、其他 中选择。",
        "输出要求：只审查当前章节；每条 finding 必须能追溯到 sourceChunkIds；如果引用法规必须填写 regulationChunkIds；references 只能引用输入中出现的文件名、章节名、法规名或片段标签；证据不足可以返回空 findings；只返回合法 JSON。",
      ].join("\n"),
      userPrompt: JSON.stringify(
        {
          metadata: buildChapterMetadataSummary(document),
          chapter: {
            id: chapter.id,
            title: chapter.title,
            chunks: chapter.chunks,
            text: chapter.text,
          },
          regulationCandidates,
          outputContract: {
            chapter_title: "string",
            summary: "string",
            findings: [
              {
                title: "string",
                category: "资格条件|评标办法|保证金条款|商务条款|技术条款|时间节点|文件完整性|其他",
                risk: "高|中|低",
                description: "string",
                recommendation: "string",
                references: ["string"],
                sourceChunkIds: ["string"],
                regulationChunkIds: ["string"],
                needsHumanReview: true,
                confidence: 0.0,
              },
            ],
          },
        },
        null,
        2,
      ),
    }),
  );
};

const buildCrossSectionPairs = (chapters: TenderChapter[]) => {
  const preferredPairs = [
    ["招标公告", "投标人须知"],
    ["招标公告", "合同"],
    ["投标人须知", "合同"],
    ["技术", "评标"],
    ["工程量清单", "技术"],
  ];

  const pairs: Array<{ a: TenderChapter; b: TenderChapter }> = [];

  preferredPairs.forEach(([leftKeyword, rightKeyword]) => {
    const left = chapters.find((chapter) => chapter.title.includes(leftKeyword));
    const right = chapters.find((chapter) => chapter.title.includes(rightKeyword));
    if (left && right) pairs.push({ a: left, b: right });
  });

  if (pairs.length === 0 && chapters.length >= 2) {
    for (let index = 0; index < Math.min(chapters.length - 1, 4); index += 1) {
      pairs.push({ a: chapters[index], b: chapters[index + 1] });
    }
  }

  return pairs;
};

const runCrossSectionScan = async (chapters: TenderChapter[], document: DocumentRecord) => {
  const pairs = buildCrossSectionPairs(chapters).map((pair) => ({
    chapterA: { title: pair.a.title, text: pair.a.text, chunkIds: pair.a.chunks.map((chunk) => chunk.id) },
    chapterB: { title: pair.b.title, text: pair.b.text, chunkIds: pair.b.chunks.map((chunk) => chunk.id) },
  }));

  return crossScanSchema.parse(
    await requestStructuredAiReview<unknown>({
      systemPrompt: [
        "你是招标文件跨章节一致性审查助手，负责识别不同章节之间的冲突、不一致、逻辑矛盾和执行风险。",
        "你的核心原则是：证据优先、结论审慎、不扩大推断、保留不确定性。",
        "你的任务是仅基于输入中的章节对，识别招标公告、投标人须知、合同条款、技术要求、评标办法、工程量清单等章节之间的要求不一致、逻辑冲突、时间节点冲突和执行风险。",
        "重点关注：招标公告与合同条款不一致、投标人须知与合同条款不一致、技术标准与评标因素不匹配、工程量清单与技术范围不一致、时间节点相互冲突、同一事项在不同章节表述不同且可能导致执行歧义。",
        "禁止行为：不能把当前章节对未覆盖写成文件存在明确冲突；不能因为措辞不同就直接认定重大矛盾；不能编造未提供的章节内容、页码或法律依据；不能输出空泛一致性评价。",
        "风险分级规则：高风险=存在明显冲突，可能导致投诉、流标、履约争议或严重影响招标执行；中风险=存在较明显不一致、歧义、前后口径不统一，需重点人工复核；低风险=轻微差异、表述层面的提醒。",
        "输出要求：只判断输入中的章节对；每条 conflict 必须追溯到 sourceChunkIds；references 只能引用输入中出现的章节标题或片段标签；证据不足时可以返回空 conflicts；只返回合法 JSON。",
      ].join("\n"),
      userPrompt: JSON.stringify(
        {
          metadata: buildChapterMetadataSummary(document),
          chapterPairs: pairs,
          outputContract: {
            conflicts: [
              {
                title: "string",
                risk: "高|中|低",
                description: "string",
                recommendation: "string",
                chapterA: "string",
                chapterB: "string",
                references: ["string"],
                sourceChunkIds: ["string"],
                needsHumanReview: true,
                confidence: 0.0,
              },
            ],
            summary: "string",
          },
        },
        null,
        2,
      ),
    }),
  );
};

export const generateTenderChapterAiFindings = async (params: {
  projectId: string;
  taskId: string;
  tenderDocument: DocumentRecord;
  regulations: Regulation[];
  onProgress?: (payload: { current: number; total: number; chapterTitle: string; stage: "chapter_review" | "cross_scan" }) => void;
}): Promise<{ findings: Finding[] }> => {
  const chapters = extractTenderChapters(params.tenderDocument);
  if (chapters.length === 0) return { findings: [] };

  const chapterResults = [];
  for (let index = 0; index < chapters.length; index += 1) {
    const chapter = chapters[index];
    params.onProgress?.({
      current: index + 1,
      total: chapters.length,
      chapterTitle: chapter.title,
      stage: "chapter_review",
    });
    chapterResults.push(await reviewTenderChapter(chapter, params.tenderDocument, params.regulations));
  }

  const chapterFindings = chapterResults.flatMap((result) =>
    result.findings.map<Finding>((finding) => ({
      id: createId("finding"),
      projectId: params.projectId,
      taskId: params.taskId,
      title: finding.title,
      category: finding.category as TenderFindingCategory,
      risk: finding.risk,
      status: "待复核",
      location: result.chapter_title,
      description: finding.description,
      recommendation: finding.recommendation,
      references: finding.references,
      sourceChunkIds: finding.sourceChunkIds,
      candidateChunkIds: [],
      regulationChunkIds: finding.regulationChunkIds,
      needsHumanReview: finding.needsHumanReview,
      confidence: finding.confidence,
      reviewStage: "chapter_review",
      scenario: "tender_compliance",
      createdAt: nowIso(),
    })),
  );

  params.onProgress?.({
    current: chapters.length,
    total: chapters.length,
    chapterTitle: "跨章节一致性检查",
    stage: "cross_scan",
  });

  const crossScan = await runCrossSectionScan(chapters, params.tenderDocument).catch(() => ({ conflicts: [], summary: "" }));
  const crossFindings = crossScan.conflicts.map<Finding>((conflict) => ({
    id: createId("finding"),
    projectId: params.projectId,
    taskId: params.taskId,
    title: conflict.title,
    category: "其他",
    risk: conflict.risk,
    status: "待复核",
    location: `${conflict.chapterA} / ${conflict.chapterB}`,
    description: conflict.description,
    recommendation: conflict.recommendation,
    references: conflict.references,
    sourceChunkIds: conflict.sourceChunkIds,
    candidateChunkIds: [],
    regulationChunkIds: [],
    needsHumanReview: conflict.needsHumanReview,
    confidence: conflict.confidence,
    reviewStage: "cross_section_review",
    scenario: "tender_compliance",
    createdAt: nowIso(),
  }));

  return {
    findings: [...chapterFindings, ...crossFindings],
  };
};
