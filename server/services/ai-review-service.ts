import { z } from "zod";
import { requestStructuredAiReview } from "./ai-client-service";
import { BidFindingCategory, DocumentRecord, Finding, Regulation, ReviewScenario, TenderFindingCategory } from "../types";
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
      preferredKeywords: ["保证金", "资格", "评标", "公平", "排斥", "限制"],
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
    systemPrompt:
      [
        "你是招标文件合规初审助手，负责基于招标文件候选片段和法规候选片段识别潜在合规问题。",
        "你的结论仅用于初审和人工复核，不构成最终法律意见。",
        "你只能依据输入中提供的招标片段和法规片段作出判断，不得引用未提供的法规、页码、章节或外部事实。",
        "如果证据不足、依据不明确或候选片段无法支撑明确结论，则不要输出高风险结论；必要时可以不输出该问题。",
        "只有在存在明确的潜在违法、违规、限制竞争、不合理门槛、明显冲突或明显缺失时才输出 finding，不要为了凑数量输出问题。",
        "risk 分级规则：高=存在明显违法违规风险、明显限制竞争、或可能导致投诉/重大合规问题；中=存在较明显争议、条件偏高、条款不合理或需要重点复核；低=轻微瑕疵、表述不清或一般性提醒。",
        "category 只能从以下枚举中选择：资格条件、评标办法、保证金条款、商务条款、技术条款、时间节点、文件完整性、其他。",
        "location 必须基于 sourceChunkIds 对应的输入片段描述，不得编造页码；若无法定位页码，可写成“招标候选片段X”。",
        "references 只能引用本次输入中出现的文件名、法规名或片段标签，不得生成输入之外的引用。",
        "sourceChunkIds 必须填写实际支撑结论的招标片段 ID；regulationChunkIds 必须填写实际支撑结论的法规片段 ID；candidateChunkIds 在本场景下通常为空数组。",
        "如果没有足够证据，请返回 {\"findings\": []}。",
        "只返回合法 JSON，不要输出解释性文字。",
      ].join("\n"),
    userPrompt: JSON.stringify(
      {
        scenario: "tender_compliance",
        tenderDocument: {
          name: tenderDocument?.originalName,
          textPreview: tenderDocument?.textPreview,
        },
        candidatePairs: candidates,
        reviewRules: {
          objective: "识别招标文件中可能违法、违规、限制竞争、不合理或需重点复核的条款。",
          evidencePrinciple: [
            "只能根据提供的 sourceChunk 和 regulationCandidates 判断",
            "证据不足时不要输出高风险结论",
            "不能把推测写成确定事实",
          ],
          categoryEnum: ["资格条件", "评标办法", "保证金条款", "商务条款", "技术条款", "时间节点", "文件完整性", "其他"],
          riskRules: {
            high: "明显违法违规、明显限制竞争、或可能导致重大投诉/合规风险",
            medium: "存在较明显争议、条件偏高、条款不合理、需重点人工复核",
            low: "轻微瑕疵、一般性提醒、表述不清但证据不足以认定严重问题",
          },
          outputRequirements: [
            "每条 finding 必须能从 sourceChunkIds 和 regulationChunkIds 追溯到输入片段",
            "references 只写输入中出现的依据",
            "如果没有明确问题，返回空 findings",
          ],
        },
        outputContract: {
          findings: [
            {
              title: "string",
              category: "string",
              risk: "高|中|低",
              location: "string",
              description: "string",
              recommendation: "string",
              references: ["string"],
              sourceChunkIds: ["string"],
              candidateChunkIds: ["string"],
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
  };
};

const buildBidConsistencyPrompt = (documents: DocumentRecord[]) => {
  const tenderDocument = documents.find((document) => document.role === "tender");
  const bidDocument = documents.find((document) => document.role === "bid");
  const candidates = buildBidConsistencyCandidates(documents);

  return {
    systemPrompt:
      [
        "你是投标文件响应性初审助手，负责基于招标文件候选片段和投标文件候选片段识别响应不一致、遗漏、偏离或需重点复核的问题。",
        "你的结论仅用于初审和人工复核，不构成最终废标或中标结论。",
        "你只能依据输入中提供的招标片段和投标片段作出判断，不得推断未提供的附件、页码、章节或外部事实。",
        "只有在存在明确的未响应、响应不完整、明显偏离、内容冲突或缺少响应证据时才输出 finding。",
        "如果投标候选片段不足以判断，应避免下高风险结论；必要时可以不输出该问题。",
        "risk 分级规则：高=可能构成实质性不响应、资格性缺失、重大技术/商务偏离；中=响应不完整、表述冲突、材料疑似缺失、需重点复核；低=轻微不一致、格式或表述层面的提醒。",
        "category 只能从以下枚举中选择：资格响应、技术响应、商务响应、附件材料、偏离风险、时间节点、其他。",
        "location 必须基于 sourceChunkIds 对应的招标片段描述，不得编造页码；若无法定位页码，可写成“招标候选片段X”。",
        "references 只能引用本次输入中出现的文件名或片段标签。",
        "sourceChunkIds 必须填写实际支撑结论的招标片段 ID；candidateChunkIds 必须填写支撑结论的投标片段 ID；regulationChunkIds 在本场景下通常为空数组。",
        "如果没有足够证据，请返回 {\"findings\": []}。",
        "只返回合法 JSON，不要输出解释性文字。",
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
        reviewRules: {
          objective: "识别投标文件相对于招标要求的未响应、响应不完整、偏离、冲突或材料缺失问题。",
          evidencePrinciple: [
            "只能根据提供的 sourceChunk 和 bidCandidates 判断",
            "不能把没有命中的片段直接当作确定缺失，除非候选证据明显不足",
            "证据不足时不要输出高风险结论",
          ],
          categoryEnum: ["资格响应", "技术响应", "商务响应", "附件材料", "偏离风险", "时间节点", "其他"],
          riskRules: {
            high: "可能构成实质性不响应、资格性缺失、重大技术或商务偏离",
            medium: "响应不完整、表述冲突、材料疑似缺失、需重点人工复核",
            low: "轻微不一致、格式或措辞层面的提醒",
          },
          outputRequirements: [
            "每条 finding 必须能从 sourceChunkIds 和 candidateChunkIds 追溯到输入片段",
            "references 只写输入中出现的依据",
            "如果没有明确问题，返回空 findings",
          ],
        },
        outputContract: {
          findings: [
            {
              title: "string",
              category: "string",
              risk: "高|中|低",
              location: "string",
              description: "string",
              recommendation: "string",
              references: ["string"],
              sourceChunkIds: ["string"],
              candidateChunkIds: ["string"],
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
  };
};

export const generateAiScenarioFindings = async (params: {
  scenario: ReviewScenario;
  projectId: string;
  taskId: string;
  documents: DocumentRecord[];
  regulations: Regulation[];
}) => {
  const prompts =
    params.scenario === "tender_compliance"
      ? buildTenderCompliancePrompt(params.documents, params.regulations)
      : buildBidConsistencyPrompt(params.documents);

  const result = aiFindingSchema.parse(
    await requestStructuredAiReview<unknown>({
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
    }),
  );

  const parsedFindings = result.findings.map((finding) => ({
    ...finding,
    category:
      params.scenario === "tender_compliance"
        ? tenderCategoryEnum.parse(finding.category) satisfies TenderFindingCategory
        : bidCategoryEnum.parse(finding.category) satisfies BidFindingCategory,
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
    scenario: params.scenario,
    createdAt: nowIso(),
  }));
};
