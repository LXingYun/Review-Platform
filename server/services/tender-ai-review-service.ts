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

const chapterTitlePatterns = [
  /^\s*第[一二三四五六七八九十百千\d]+章[^\n]{0,50}/,
  /^\s*第[一二三四五六七八九十百千\d]+节[^\n]{0,40}/,
  /^\s*\d+\.(?!\d)\s*(项目概况与招标范围|投标人资格要求|招标文件的获取|投标文件的递交|开标时间及地点|发布公告的媒介|联系方式|总则|招标文件|投标文件|评标办法|合同条款|电子招标投标相关要求)[^\n]{0,40}/,
  /^\s*(招标公告|投标人须知|评标办法|合同条款(?:及格式)?|工程量清单|技术要求|技术标准|资格审查|商务条款|投标文件格式|电子招标投标相关要求|项目概况与招标范围)[^\n]{0,40}/,
];

const normalizeTitle = (text: string) => text.replace(/\s+/g, " ").trim();

const stripLeadingPageNumber = (text: string) => {
  const normalized = normalizeTitle(text);
  return normalized.replace(/^(\d+)\s+(?=(第|\d+\.(?!\d)|招标公告|投标人须知|评标办法|合同条款|工程量清单|技术要求|技术标准|资格审查|商务条款|投标文件格式|电子招标投标相关要求))/u, "");
};

const isTocNoise = (text: string) => {
  const normalized = normalizeTitle(text);
  if (normalized.length < 4) return true;
  if (normalized.includes("目录") && normalized.length <= 12) return true;
  if (/\.{3,}\s*\d+$/.test(normalized)) return true;
  if (/^\d+$/.test(normalized)) return true;
  if (/^\d+[、.]/.test(normalized) && !/^\d+\.(?!\d)/.test(normalized)) return true;
  if (/^第[一二三四五六七八九十百千\d]+条/.test(normalized)) return true;
  if (/^\d+\.\d+/.test(normalized)) return true;
  return false;
};

const extractChapterTitle = (text: string) => {
  const sanitized = stripLeadingPageNumber(text);

  for (const pattern of chapterTitlePatterns) {
    const match = sanitized.match(pattern);
    if (!match?.[0]) continue;

    const normalized = normalizeTitle(match[0]);
    if (!isTocNoise(normalized)) {
      return normalized;
    }
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
    if (!unique.has(key)) {
      unique.set(key, candidate);
    }
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

const reviewTenderChapter = async (
  chapter: TenderChapter,
  document: DocumentRecord,
  regulations: Regulation[],
  signal?: AbortSignal,
) => {
  const regulationCandidates = buildRegulationCandidatesForChapter(chapter, regulations);

  return chapterReviewSchema.parse(
    await requestStructuredAiReview<unknown>({
      systemPrompt: [
        "你是建设工程与政府采购场景的招标文件章节审查助手。",
        "只针对当前章节进行初审，识别资格条件、评标办法、保证金、商务条款、技术条款、时间节点和文件完整性方面的问题。",
        "只能依据输入片段与法规候选作出判断，不得编造页码、条文编号或外部法规。",
        "证据不足时不要输出问题。",
        "只返回合法 JSON。",
      ].join("\n"),
      userPrompt: JSON.stringify(
        {
          metadata: buildChapterMetadataSummary(document),
          chapter: {
            id: chapter.id,
            title: chapter.title,
            pageRange: chapter.pageRange,
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
                confidence: 0,
              },
            ],
          },
        },
        null,
        2,
      ),
      signal,
    }),
  );
};

const buildCrossSectionPairs = (chapters: TenderChapter[]) => {
  const preferredPairs = [
    ["招标公告", "投标人须知"],
    ["招标公告", "合同条款"],
    ["投标人须知", "合同条款"],
    ["技术", "评标"],
    ["工程量清单", "技术"],
  ];

  const pairs: Array<{ a: TenderChapter; b: TenderChapter }> = [];

  preferredPairs.forEach(([leftKeyword, rightKeyword]) => {
    const left = chapters.find((chapter) => chapter.title.includes(leftKeyword));
    const right = chapters.find((chapter) => chapter.title.includes(rightKeyword));
    if (left && right) {
      pairs.push({ a: left, b: right });
    }
  });

  if (pairs.length === 0 && chapters.length >= 2) {
    for (let index = 0; index < Math.min(chapters.length - 1, 4); index += 1) {
      pairs.push({ a: chapters[index], b: chapters[index + 1] });
    }
  }

  return pairs;
};

const runCrossSectionScan = async (chapters: TenderChapter[], document: DocumentRecord, signal?: AbortSignal) => {
  const pairs = buildCrossSectionPairs(chapters).map((pair) => ({
    chapterA: { title: pair.a.title, text: pair.a.text, chunkIds: pair.a.chunks.map((chunk) => chunk.id) },
    chapterB: { title: pair.b.title, text: pair.b.text, chunkIds: pair.b.chunks.map((chunk) => chunk.id) },
  }));

  return crossScanSchema.parse(
    await requestStructuredAiReview<unknown>({
      systemPrompt: [
        "你是招标文件跨章节一致性审查助手。",
        "请识别不同章节之间的冲突、不一致、逻辑矛盾和执行风险。",
        "只能依据输入章节对作出判断，不得编造缺失章节、页码或外部事实。",
        "证据不足时返回空 conflicts。",
        "只返回合法 JSON。",
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
                confidence: 0,
              },
            ],
            summary: "string",
          },
        },
        null,
        2,
      ),
      signal,
    }),
  );
};

export const generateTenderChapterAiFindings = async (params: {
  projectId: string;
  taskId: string;
  tenderDocument: DocumentRecord;
  regulations: Regulation[];
  signal?: AbortSignal;
  onProgress?: (payload: {
    current: number;
    total: number;
    chapterTitle: string;
    stage: "chapter_review" | "cross_scan";
  }) => void;
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
    chapterResults.push(await reviewTenderChapter(chapter, params.tenderDocument, params.regulations, params.signal));
  }

  const chapterFindings = chapterResults.flatMap((result) =>
    result.findings.map((finding) => ({
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
      reviewLogs: [],
      createdAt: nowIso(),
    }) as Finding),
  );

  params.onProgress?.({
    current: chapters.length,
    total: chapters.length,
    chapterTitle: "跨章节一致性检查",
    stage: "cross_scan",
  });

  const crossScan = await runCrossSectionScan(chapters, params.tenderDocument, params.signal).catch(() => ({
    conflicts: [],
    summary: "",
  }));

  const crossFindings = crossScan.conflicts.map((conflict) => ({
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
    reviewLogs: [],
    createdAt: nowIso(),
  }) as Finding);

  return {
    findings: [...chapterFindings, ...crossFindings],
  };
};
