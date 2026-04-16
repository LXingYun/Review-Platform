export type ReviewScenario = "tender_compliance" | "bid_consistency";
export type UserRole = "admin" | "user";

export type ReviewConsistencyMode = "balanced" | "strict";

export type ReviewConsistencyResult = "first-run" | "consistent" | "drifted";

export interface ReviewConsistencyDiffSummary {
  added: number;
  removed: number;
  changedRisk: number;
}

export type ProjectReviewType = "\u62db\u6807\u5ba1\u67e5" | "\u6295\u6807\u5ba1\u67e5";

export type ProjectStatus = "\u5f85\u5f00\u59cb" | "\u8fdb\u884c\u4e2d" | "\u5df2\u5b8c\u6210" | "\u672a\u5b8c\u6210";

export type ReviewTaskStatus = "\u5f85\u5ba1\u6838" | "\u8fdb\u884c\u4e2d" | "\u5df2\u5b8c\u6210" | "\u5931\u8d25" | "\u672a\u5b8c\u6210";

export type ReviewTaskStage =
  | "queued"
  | "preparing_context"
  | "ai_review"
  | "chapter_review"
  | "cross_section_review"
  | "consolidating"
  | "completed"
  | "failed"
  | "aborted"
  | "interrupted";

export type RiskLevel = "\u9ad8" | "\u4e2d" | "\u4f4e";

export type FindingStatus = "\u5f85\u590d\u6838" | "\u5df2\u786e\u8ba4" | "\u5df2\u5ffd\u7565";

export type TenderFindingCategory =
  | "\u8d44\u683c\u6761\u4ef6"
  | "\u8bc4\u6807\u529e\u6cd5"
  | "\u4fdd\u8bc1\u91d1\u6761\u6b3e"
  | "\u5546\u52a1\u6761\u6b3e"
  | "\u6280\u672f\u6761\u6b3e"
  | "\u65f6\u95f4\u8282\u70b9"
  | "\u6587\u4ef6\u5b8c\u6574\u6027"
  | "\u5176\u4ed6";

export type BidFindingCategory =
  | "\u8d44\u683c\u54cd\u5e94"
  | "\u6280\u672f\u54cd\u5e94"
  | "\u5546\u52a1\u54cd\u5e94"
  | "\u9644\u4ef6\u6750\u6599"
  | "\u504f\u79bb\u98ce\u9669"
  | "\u65f6\u95f4\u8282\u70b9"
  | "\u5176\u4ed6";

export type FindingCategory = TenderFindingCategory | BidFindingCategory;

export type DocumentRole = "tender" | "bid" | "regulation" | "clarification" | "attachment";

export type DocumentParseStatus = "\u5f85\u89e3\u6790" | "\u89e3\u6790\u4e2d" | "\u5df2\u5b8c\u6210";

export type DocumentParseMethod = "pdf-text" | "plain-text" | "image-ocr" | "binary-placeholder";

export type FindingReviewStage = "chapter_review" | "cross_section_review" | "response_consistency_review";

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
  ownerUserId?: string;
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
  parseStatus: DocumentParseStatus;
  pageCount: number;
  parseMethod: DocumentParseMethod;
  textPreview: string;
  extractedText: string;
  chunks: DocumentChunk[];
  contentHash?: string;
  uploadedAt: string;
}

export interface ReviewTask {
  id: string;
  projectId: string;
  scenario: ReviewScenario;
  consistencyMode?: ReviewConsistencyMode;
  consistencyFingerprint?: string;
  consistencyRunHash?: string;
  consistencyResult?: ReviewConsistencyResult;
  consistencyDiffSummary?: ReviewConsistencyDiffSummary;
  name: string;
  status: ReviewTaskStatus;
  stage: ReviewTaskStage;
  stageLabel: string;
  progress: number;
  riskLevel: RiskLevel;
  documentIds: string[];
  regulationIds?: string[];
  regulationSnapshot?: Regulation[];
  attemptCount: number;
  createdAt: string;
  completedAt: string | null;
}

export interface FindingReviewLog {
  id: string;
  action: "comment" | "confirm" | "ignore";
  status?: FindingStatus;
  note: string;
  reviewer: string;
  createdAt: string;
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
  reviewStage: FindingReviewStage;
  scenario: ReviewScenario;
  reviewLogs: FindingReviewLog[];
  createdAt: string;
}

export interface RegulationSection {
  title: string;
  rules: number;
}

export interface Regulation {
  id: string;
  name: string;
  category: string;
  ruleCount: number;
  updated: string;
  textPreview: string;
  chunks: DocumentChunk[];
  sections: RegulationSection[];
}

export interface AppData {
  projects: Project[];
  documents: DocumentRecord[];
  reviewTasks: ReviewTask[];
  findings: Finding[];
  regulations: Regulation[];
}
