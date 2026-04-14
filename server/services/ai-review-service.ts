import { z } from "zod";
import { requestStructuredAiReview } from "./ai-client-service";
import {
  BidFindingCategory,
  DocumentRecord,
  Finding,
  Regulation,
  ReviewScenario,
  TenderFindingCategory,
} from "../types";
import { matchBidChunks } from "./bid-match-service";
import { matchRegulationChunks } from "./regulation-match-service";
import { createId, nowIso } from "../utils";

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

const bidCategoryEnum = z.enum([
  "资格响应",
  "技术响应",
  "商务响应",
  "附件材料",
  "偏离风险",
  "时间节点",
  "其他",
]);

const aiFindingSchema = z.object({
  findings: z.array(
    z.object({
      title: z.string(),
      category: z.string(),
      risk: z.enum(["高", "中", "低"]),
      location: z.string(),
      description: z.string(),
      recommendation: z.string(),
      references: z.array(z.string()).default([]),
      sourceChunkIds: z.array(z.string()).default([]),
      candidateChunkIds: z.array(z.string()).default([]),
      regulationChunkIds: z.array(z.string()).default([]),
      needsHumanReview: z.boolean().default(true),
      confidence: z.number().min(0).max(1).default(0.5),
    }),
  ),
});

const selectChunksByKeywords = (document: DocumentRecord | undefined, keywords: string[]) => {
  if (!document) return [];

  const matched = document.chunks.filter((chunk) => keywords.some((keyword) => chunk.text.includes(keyword)));
  return matched.length > 0 ? matched.slice(0, 3) : document.chunks.slice(0, 2);
};

const buildTenderComplianceCandidates = (documents: DocumentRecord[], regulations: Regulation[]) => {
  const tenderDocument = documents.find((document) => document.role === "tender");
  if (!tenderDocument) return [];

  const sourceChunks = [
    ...selectChunksByKeywords(tenderDocument, ["保证金", "投标保证金"]),
    ...selectChunksByKeywords(tenderDocument, ["评标", "评分"]),
    ...selectChunksByKeywords(tenderDocument, ["资质", "资格"]),
  ].slice(0, 5);

  return sourceChunks.map((sourceChunk) => ({
    sourceChunk,
    regulationCandidates: matchRegulationChunks({
      sourceChunk,
      regulations,
      preferredKeywords: ["保证金", "资格", "资质", "评标", "评分", "公平", "排斥", "限制"],
      limit: 2,
    }).map((candidate) => ({
      regulationName: candidate.regulation.name,
      regulationCategory: candidate.regulation.category,
      score: candidate.score,
      matchedKeywords: candidate.matchedKeywords,
      chunk: candidate.chunk,
    })),
  }));
};

const buildBidConsistencyCandidates = (documents: DocumentRecord[]) => {
  const tenderDocument = documents.find((document) => document.role === "tender");
  const bidDocument = documents.find((document) => document.role === "bid");
  if (!tenderDocument || !bidDocument) return [];

  const sourceChunks = [
    ...selectChunksByKeywords(tenderDocument, ["付款", "结算"]),
    ...selectChunksByKeywords(tenderDocument, ["资质", "资格", "证明"]),
    ...selectChunksByKeywords(tenderDocument, ["技术", "参数", "偏离"]),
  ].slice(0, 5);

  return sourceChunks.map((sourceChunk) => ({
    sourceChunk,
    bidCandidates: matchBidChunks({
      sourceChunk,
      bidChunks: bidDocument.chunks,
      preferredKeywords: ["付款", "结算", "资质", "资格", "证明", "技术", "参数", "偏离"],
      limit: 2,
    }).map((candidate) => ({
      score: candidate.score,
      matchedKeywords: candidate.matchedKeywords,
      chunk: candidate.chunk,
    })),
  }));
};

const buildTenderCompliancePrompt = (documents: DocumentRecord[], regulations: Regulation[]) => {
  const tenderDocument = documents.find((document) => document.role === "tender");
  const candidates = buildTenderComplianceCandidates(documents, regulations);

  return {
    systemPrompt: [
      "你是招标文件合规初审助手，负责根据招标片段与法规片段识别潜在合规问题。",
      "只能依据输入片段作出判断，不得引用外部事实，不得编造页码、章节或法规。",
      "只有在证据足够支撑时才输出问题，证据不足时返回空 findings。",
      "risk 规则：高=明显违法违规或明显限制竞争；中=存在较明显争议或需重点复核；低=轻微瑕疵或一般提醒。",
      "category 只能从以下枚举中选择：资格条件、评标办法、保证金条款、商务条款、技术条款、时间节点、文件完整性、其他。",
      "references 只能引用输入里出现的文件名、法规名或片段标签。",
      "sourceChunkIds 和 regulationChunkIds 必须可追溯到输入片段。",
      "只返回合法 JSON。",
    ].join("\n"),
    userPrompt: JSON.stringify(
      {
        scenario: "tender_compliance",
        tenderDocument: {
          name: tenderDocument?.originalName,
          textPreview: tenderDocument?.textPreview,
        },
        candidatePairs: candidates,
        outputContract: {
          findings: [
            {
              title: "string",
              category: "资格条件|评标办法|保证金条款|商务条款|技术条款|时间节点|文件完整性|其他",
              risk: "高|中|低",
              location: "string",
              description: "string",
              recommendation: "string",
              references: ["string"],
              sourceChunkIds: ["string"],
              candidateChunkIds: ["string"],
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
  };
};

const buildBidConsistencyPrompt = (documents: DocumentRecord[]) => {
  const tenderDocument = documents.find((document) => document.role === "tender");
  const bidDocument = documents.find((document) => document.role === "bid");
  const candidates = buildBidConsistencyCandidates(documents);

  return {
    systemPrompt: [
      "你是投标响应一致性初审助手，负责识别投标文件相对于招标要求的未响应、缺失、冲突或偏离。",
      "只能依据输入片段作出判断，不得编造缺失附件、页码或外部事实。",
      "只有在证据足够时才输出问题，证据不足时返回空 findings。",
      "risk 规则：高=可能构成实质性不响应或重大偏离；中=响应不完整或需重点复核；低=轻微不一致或一般提醒。",
      "category 只能从以下枚举中选择：资格响应、技术响应、商务响应、附件材料、偏离风险、时间节点、其他。",
      "references 只能引用输入里出现的文件名或片段标签。",
      "sourceChunkIds 和 candidateChunkIds 必须可追溯到输入片段。",
      "只返回合法 JSON。",
    ].join("\n"),
    userPrompt: JSON.stringify(
      {
        scenario: "bid_consistency",
        tenderDocument: {
          name: tenderDocument?.originalName,
          textPreview: tenderDocument?.textPreview,
        },
        bidDocument: {
          name: bidDocument?.originalName,
          textPreview: bidDocument?.textPreview,
        },
        candidatePairs: candidates,
        outputContract: {
          findings: [
            {
              title: "string",
              category: "资格响应|技术响应|商务响应|附件材料|偏离风险|时间节点|其他",
              risk: "高|中|低",
              location: "string",
              description: "string",
              recommendation: "string",
              references: ["string"],
              sourceChunkIds: ["string"],
              candidateChunkIds: ["string"],
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
  };
};

export const generateAiScenarioFindings = async (params: {
  scenario: ReviewScenario;
  projectId: string;
  taskId: string;
  documents: DocumentRecord[];
  regulations: Regulation[];
  seed?: number;
  signal?: AbortSignal;
}) => {
  const prompts =
    params.scenario === "tender_compliance"
      ? buildTenderCompliancePrompt(params.documents, params.regulations)
      : buildBidConsistencyPrompt(params.documents);

  const result = aiFindingSchema.parse(
    await requestStructuredAiReview<unknown>({
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      seed: params.seed,
      signal: params.signal,
      taskId: params.taskId,
    }),
  );

  const parsedFindings = result.findings.map((finding) => ({
    ...finding,
    category:
      params.scenario === "tender_compliance"
        ? (tenderCategoryEnum.parse(finding.category) satisfies TenderFindingCategory)
        : (bidCategoryEnum.parse(finding.category) satisfies BidFindingCategory),
  }));

  return parsedFindings.map<Finding>((finding) => ({
    id: createId("finding"),
    projectId: params.projectId,
    taskId: params.taskId,
    title: finding.title,
    category: finding.category,
    risk: finding.risk,
    status: "待复核",
    location: finding.location,
    description: finding.description,
    recommendation: finding.recommendation,
    references: finding.references,
    sourceChunkIds: finding.sourceChunkIds,
    candidateChunkIds: finding.candidateChunkIds,
    regulationChunkIds: finding.regulationChunkIds,
    needsHumanReview: finding.needsHumanReview,
    confidence: finding.confidence,
    reviewStage: params.scenario === "bid_consistency" ? "response_consistency_review" : "chapter_review",
    scenario: params.scenario,
    reviewLogs: [],
    createdAt: nowIso(),
  }));
};
