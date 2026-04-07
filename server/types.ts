export type ReviewScenario = "tender_compliance" | "bid_consistency";

export type ProjectReviewType = "招标审查" | "投标审查";

export type ProjectStatus = "待开始" | "进行中" | "已完成";

export type ReviewTaskStatus = "待审查" | "进行中" | "已完成" | "失败";

export type RiskLevel = "高" | "中" | "低";

export type FindingStatus = "待复核" | "已确认" | "已忽略";

export type TenderFindingCategory =
  | "资格条件"
  | "评标办法"
  | "保证金条款"
  | "商务条款"
  | "技术条款"
  | "时间节点"
  | "文件完整性"
  | "其他";

export type BidFindingCategory =
  | "资格响应"
  | "技术响应"
  | "商务响应"
  | "附件材料"
  | "偏离风险"
  | "时间节点"
  | "其他";

export type FindingCategory = TenderFindingCategory | BidFindingCategory;

export type DocumentRole = "tender" | "bid" | "regulation" | "clarification" | "attachment";

export interface DocumentChunk {
  id: string;
  text: string;
  order: number;
  sectionTitle?: string;
}

export interface Project {
  id: string;
  name: string;
  type: ProjectReviewType;
  status: ProjectStatus;
  description: string;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  projectId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  role: DocumentRole;
  storagePath: string;
  parseStatus: "待解析" | "解析中" | "已完成";
  pageCount: number;
  parseMethod: "pdf-text" | "plain-text" | "image-ocr" | "binary-placeholder";
  textPreview: string;
  extractedText: string;
  chunks: DocumentChunk[];
  uploadedAt: string;
}

export interface ReviewTask {
  id: string;
  projectId: string;
  scenario: ReviewScenario;
  name: string;
  status: ReviewTaskStatus;
  stageLabel: string;
  progress: number;
  riskLevel: RiskLevel;
  documentIds: string[];
  createdAt: string;
  completedAt: string | null;
}

export interface Finding {
  id: string;
  projectId: string;
  taskId: string;
  title: string;
  category: FindingCategory;
  risk: RiskLevel;
  status: FindingStatus;
  location: string;
  description: string;
  recommendation: string;
  references: string[];
  sourceChunkIds: string[];
  candidateChunkIds: string[];
  regulationChunkIds: string[];
  needsHumanReview: boolean;
  confidence: number;
  reviewStage: "chapter_review" | "cross_section_review" | "response_consistency_review";
  scenario: ReviewScenario;
  createdAt: string;
}

export interface Regulation {
  id: string;
  name: string;
  category: string;
  ruleCount: number;
  updated: string;
  textPreview: string;
  chunks: DocumentChunk[];
  sections: Array<{
    title: string;
    rules: number;
  }>;
}

export interface AppData {
  projects: Project[];
  documents: DocumentRecord[];
  reviewTasks: ReviewTask[];
  findings: Finding[];
  regulations: Regulation[];
}
