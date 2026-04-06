import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { DocumentChunk, DocumentRecord, Finding, Regulation, ReviewScenario, RiskLevel } from "./types";
import { matchBidChunks } from "./services/bid-match-service";
import { matchRegulationChunks } from "./services/regulation-match-service";

export const createId = (prefix: string) => `${prefix}-${uuidv4()}`;

export const nowIso = () => new Date().toISOString();

export const toDisplaySize = (sizeBytes: number) => `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;

export const sanitizeFileName = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").toLowerCase();

export const extensionFromName = (name: string) => path.extname(name).toLowerCase();

export const normalizeUploadedFileName = (name: string) => {
  try {
    // Multer on Windows may expose UTF-8 filenames as latin1-decoded strings.
    return Buffer.from(name, "latin1").toString("utf8");
  } catch {
    return name;
  }
};

export const summarizeRisk = (risks: RiskLevel[]): RiskLevel => {
  if (risks.includes("高")) return "高";
  if (risks.includes("中")) return "中";
  return "低";
};

const findChunkByKeyword = (document: DocumentRecord | undefined, keywords: string[]) => {
  if (!document) return null;

  return (
    document.chunks.find((chunk) => keywords.some((keyword) => chunk.text.includes(keyword))) ??
    document.chunks[0] ??
    null
  );
};

const buildChunkReference = (document: DocumentRecord | undefined, keywords: string[], fallback: string) => {
  const chunk = findChunkByKeyword(document, keywords);

  if (!chunk) return [document?.originalName ?? fallback, fallback];

  return [
    `${document?.originalName ?? fallback} · 片段 ${chunk.order}`,
    chunk.text,
  ];
};

const findRegulationChunkByKeyword = (regulation: Regulation | undefined, keywords: string[]) => {
  if (!regulation) return null;

  return (
    regulation.chunks.find((chunk) => keywords.some((keyword) => chunk.text.includes(keyword))) ??
    regulation.chunks[0] ??
    null
  );
};

const buildRegulationReferencesFromCandidates = (
  sourceChunk: DocumentChunk | null,
  regulations: Regulation[],
  keywords: string[],
  fallback: string,
) => {
  if (!sourceChunk) return [fallback];

  const candidates = matchRegulationChunks({
    sourceChunk,
    regulations,
    preferredKeywords: keywords,
    limit: 2,
  });

  if (candidates.length === 0) return [fallback];

  return candidates.flatMap((candidate) => [
    `${candidate.regulation.name}${candidate.chunk.sectionTitle ? ` · ${candidate.chunk.sectionTitle}` : ""} · 条款片段 ${candidate.chunk.order}`,
    candidate.chunk.text,
  ]);
};

const getRegulationChunkIdsFromCandidates = (
  sourceChunk: DocumentChunk | null,
  regulations: Regulation[],
  keywords: string[],
) => {
  if (!sourceChunk) return [];

  return matchRegulationChunks({
    sourceChunk,
    regulations,
    preferredKeywords: keywords,
    limit: 2,
  }).map((candidate) => candidate.chunk.id);
};

const buildBidReferencesFromCandidates = (
  sourceChunk: DocumentChunk | null,
  bidDocument: DocumentRecord | undefined,
  keywords: string[],
  fallback: string,
) => {
  if (!sourceChunk || !bidDocument) return [fallback];

  const candidates = matchBidChunks({
    sourceChunk,
    bidChunks: bidDocument.chunks,
    preferredKeywords: keywords,
    limit: 2,
  });

  if (candidates.length === 0) return [fallback];

  return candidates.flatMap((candidate) => [
    `${bidDocument.originalName} · 片段 ${candidate.chunk.order}`,
    candidate.chunk.text,
  ]);
};

const getBidCandidateChunkIds = (
  sourceChunk: DocumentChunk | null,
  bidDocument: DocumentRecord | undefined,
  keywords: string[],
) => {
  if (!sourceChunk || !bidDocument) return [];

  return matchBidChunks({
    sourceChunk,
    bidChunks: bidDocument.chunks,
    preferredKeywords: keywords,
    limit: 2,
  }).map((candidate) => candidate.chunk.id);
};

export const generateScenarioFindings = (
  scenario: ReviewScenario,
  projectId: string,
  taskId: string,
  documents: DocumentRecord[],
  regulations: Regulation[],
): Finding[] => {
  const createdAt = nowIso();

  if (scenario === "tender_compliance") {
    const tenderDocument = documents.find((document) => document.role === "tender");
    const text = tenderDocument?.extractedText ?? "";
    const findings: Finding[] = [];

    if (text.includes("保证金") || text.includes("投标保证金")) {
      const sourceChunk = findChunkByKeyword(tenderDocument, ["保证金", "投标保证金"]);
      const references = buildChunkReference(tenderDocument, ["保证金", "投标保证金"], "保证金条款");
      const regulationReferences = buildRegulationReferencesFromCandidates(
        sourceChunk,
        regulations,
        ["保证金", "百分之二"],
        "保证金法规依据",
      );
      const regulationChunkIds = getRegulationChunkIdsFromCandidates(
        sourceChunk,
        regulations,
        ["保证金", "百分之二"],
      );
      findings.push({
        id: createId("finding"),
        projectId,
        taskId,
        title: "文档中存在保证金相关条款，需重点核验比例",
        category: "保证金条款",
        risk: "高",
        status: "待复核",
        location: "自动解析命中：保证金关键词",
        description: "系统在招标文件中识别到保证金条款，但当前尚未自动抽取比例数值，建议优先复核是否超出监管要求。",
        recommendation: "补充保证金比例抽取规则，并人工核对对应页码和法条依据。",
        references: [...references, ...regulationReferences],
        sourceChunkIds: sourceChunk ? [sourceChunk.id] : [],
        candidateChunkIds: [],
        regulationChunkIds,
        needsHumanReview: true,
        confidence: 0.58,
        scenario,
        createdAt,
      });
    }

    if (text.includes("评标") || text.includes("评分")) {
      const sourceChunk = findChunkByKeyword(tenderDocument, ["评标", "评分"]);
      const references = buildChunkReference(tenderDocument, ["评标", "评分"], "评标条款");
      const regulationReferences = buildRegulationReferencesFromCandidates(
        sourceChunk,
        regulations,
        ["公平", "排斥", "限制"],
        "评标法规依据",
      );
      const regulationChunkIds = getRegulationChunkIdsFromCandidates(
        sourceChunk,
        regulations,
        ["公平", "排斥", "限制"],
      );
      findings.push({
        id: createId("finding"),
        projectId,
        taskId,
        title: "文档包含评标或评分条款，需检查是否存在倾向性描述",
        category: "评标办法",
        risk: "中",
        status: "待复核",
        location: "自动解析命中：评标/评分关键词",
        description: "系统识别到评标相关章节，建议复核评分细则是否引用特定品牌、资质或排他性要求。",
        recommendation: "后续接入条款切分后，对评分细则做逐条法规对照。",
        references: [...references, ...regulationReferences],
        sourceChunkIds: sourceChunk ? [sourceChunk.id] : [],
        candidateChunkIds: [],
        regulationChunkIds,
        needsHumanReview: true,
        confidence: 0.62,
        scenario,
        createdAt,
      });
    }

    if (text.includes("资质") || text.includes("资格")) {
      const sourceChunk = findChunkByKeyword(tenderDocument, ["资质", "资格"]);
      const references = buildChunkReference(tenderDocument, ["资质", "资格"], "资质条款");
      const regulationReferences = buildRegulationReferencesFromCandidates(
        sourceChunk,
        regulations,
        ["资格", "技术", "商务条件"],
        "资格法规依据",
      );
      const regulationChunkIds = getRegulationChunkIdsFromCandidates(
        sourceChunk,
        regulations,
        ["资格", "技术", "商务条件"],
      );
      findings.push({
        id: createId("finding"),
        projectId,
        taskId,
        title: "文档包含资格或资质要求，需复核门槛设置",
        category: "资格条件",
        risk: "中",
        status: "待复核",
        location: "自动解析命中：资质/资格关键词",
        description: "系统识别到投标人资格要求，存在设置门槛偏高或限制竞争的潜在风险。",
        recommendation: "结合项目规模、行业惯例和法规要求复核资质级别。",
        references: [...references, ...regulationReferences],
        sourceChunkIds: sourceChunk ? [sourceChunk.id] : [],
        candidateChunkIds: [],
        regulationChunkIds,
        needsHumanReview: true,
        confidence: 0.6,
        scenario,
        createdAt,
      });
    }

    if (findings.length > 0) return findings;
  }

  if (scenario === "bid_consistency") {
    const tenderDocument = documents.find((document) => document.role === "tender");
    const bidDocument = documents.find((document) => document.role === "bid");
    const tenderText = tenderDocument?.extractedText ?? "";
    const bidText = bidDocument?.extractedText ?? "";
    const findings: Finding[] = [];

    if (tenderText.includes("付款") && !bidText.includes("付款")) {
      const sourceChunk = findChunkByKeyword(tenderDocument, ["付款"]);
      const tenderReferences = buildChunkReference(tenderDocument, ["付款"], "付款条款");
      const bidReferences = buildBidReferencesFromCandidates(
        sourceChunk,
        bidDocument,
        ["付款", "结算"],
        "投标未命中付款片段",
      );
      const candidateChunkIds = getBidCandidateChunkIds(sourceChunk, bidDocument, ["付款", "结算"]);
      findings.push({
        id: createId("finding"),
        projectId,
        taskId,
        title: "投标文件未明显响应付款条款",
        category: "商务响应",
        risk: "中",
        status: "待复核",
        location: "招标命中付款关键词，投标未命中",
        description: "系统在招标文件中识别到付款相关要求，但投标文件文本中未发现明显对应内容，可能存在响应不完整。",
        recommendation: "复核投标文件商务响应表，补充付款节点和结算条件说明。",
        references: [...tenderReferences, ...bidReferences],
        sourceChunkIds: sourceChunk ? [sourceChunk.id] : [],
        candidateChunkIds,
        regulationChunkIds: [],
        needsHumanReview: true,
        confidence: 0.56,
        scenario,
        createdAt,
      });
    }

    if (tenderText.includes("资质") && !bidText.includes("资质")) {
      const sourceChunk = findChunkByKeyword(tenderDocument, ["资质", "资格"]);
      const tenderReferences = buildChunkReference(tenderDocument, ["资质", "资格"], "资质条款");
      const bidReferences = buildBidReferencesFromCandidates(
        sourceChunk,
        bidDocument,
        ["资质", "资格", "证明"],
        "投标未命中资质片段",
      );
      const candidateChunkIds = getBidCandidateChunkIds(sourceChunk, bidDocument, ["资质", "资格", "证明"]);
      findings.push({
        id: createId("finding"),
        projectId,
        taskId,
        title: "投标文件缺少资质关键词响应，需检查附件完整性",
        category: "附件材料",
        risk: "高",
        status: "待复核",
        location: "招标命中资质关键词，投标未命中",
        description: "招标文件包含资质要求，但投标文件提取文本中未发现明显资质响应内容，可能遗漏附件或目录标注。",
        recommendation: "补充资质证明、授权文件，并确保可解析文本中能识别附件目录。",
        references: [...tenderReferences, ...bidReferences],
        sourceChunkIds: sourceChunk ? [sourceChunk.id] : [],
        candidateChunkIds,
        regulationChunkIds: [],
        needsHumanReview: true,
        confidence: 0.59,
        scenario,
        createdAt,
      });
    }

    if (tenderText.includes("技术") && bidText.includes("偏离")) {
      const sourceChunk = findChunkByKeyword(tenderDocument, ["技术"]);
      const tenderReferences = buildChunkReference(tenderDocument, ["技术"], "技术条款");
      const bidReferences = buildBidReferencesFromCandidates(
        sourceChunk,
        bidDocument,
        ["偏离", "技术", "参数"],
        "技术偏离片段",
      );
      const candidateChunkIds = getBidCandidateChunkIds(sourceChunk, bidDocument, ["偏离", "技术", "参数"]);
      findings.push({
        id: createId("finding"),
        projectId,
        taskId,
        title: "检测到技术偏离相关内容，需逐项核对技术参数",
        category: "技术响应",
        risk: "中",
        status: "待复核",
        location: "自动解析命中：技术 / 偏离关键词",
        description: "系统识别到招标文件技术要求与投标文件偏离表，建议进入逐项参数匹配流程，确认是否存在重大偏离。",
        recommendation: "下一阶段接入表格提取后，对技术参数表进行逐条比对。",
        references: [...tenderReferences, ...bidReferences],
        sourceChunkIds: sourceChunk ? [sourceChunk.id] : [],
        candidateChunkIds,
        regulationChunkIds: [],
        needsHumanReview: true,
        confidence: 0.63,
        scenario,
        createdAt,
      });
    }

    if (findings.length > 0) return findings;
  }

  return [
    {
      id: createId("finding"),
      projectId,
      taskId,
      title: "已完成基础文本解析，但暂未命中特定规则",
      category: "其他",
      risk: "低",
      status: "待复核",
      location: "全文级别",
      description: "当前版本已从文件中抽取文本，但规则库仍然较轻量，建议结合原文继续人工复核。",
      recommendation: "下一步优先补充条款切分、OCR 和表格解析能力。",
      references: documents.flatMap((document) => {
        const chunk = document.chunks[0];
        if (!chunk) return [document.originalName];
        return [`${document.originalName} · 片段 ${chunk.order}`, chunk.text];
      }),
      sourceChunkIds: documents.flatMap((document) => (document.chunks[0] ? [document.chunks[0].id] : [])),
      candidateChunkIds: [],
      regulationChunkIds: [],
      needsHumanReview: true,
      confidence: 0.35,
      scenario,
      createdAt,
    },
  ];
};
