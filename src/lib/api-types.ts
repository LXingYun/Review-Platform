export interface DashboardStat {
  label: string;
  value: string;
  change: string;
  color: string;
}

export interface DashboardTask {
  id: string;
  name: string;
  status: string;
  risk: "高" | "中" | "低";
  progress: number;
}

export interface DashboardResponse {
  stats: DashboardStat[];
  recentTasks: DashboardTask[];
}

export interface ProjectListItem {
  id: string;
  name: string;
  type: string;
  status: string;
  description: string;
  taskCount: number;
  issueCount: number;
  date: string;
}

export interface ProjectDetailItem extends ProjectListItem {}

export interface DocumentItem {
  id: string;
  projectId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  role: "tender" | "bid" | "regulation" | "clarification" | "attachment";
  storagePath: string;
  parseStatus: "待解析" | "解析中" | "已完成";
  pageCount: number;
  parseMethod: "pdf-text" | "plain-text" | "image-ocr" | "binary-placeholder";
  textPreview: string;
  extractedText: string;
  chunks: Array<{
    id: string;
    text: string;
    order: number;
  }>;
  uploadedAt: string;
}

export interface ReviewTaskResult {
  task: {
    id: string;
    name: string;
    status: string;
    progress: number;
    riskLevel: "高" | "中" | "低";
  };
  findings: Array<{
    id: string;
    title: string;
    risk: "高" | "中" | "低";
  }>;
}

export interface ReviewTaskItem {
  id: string;
  projectId: string;
  projectName: string;
  scenario: "tender_compliance" | "bid_consistency";
  name: string;
  status: string;
  progress: number;
  riskLevel: "高" | "中" | "低";
  documentIds: string[];
  createdAt: string;
  completedAt: string | null;
}

export interface ReviewTaskDetailItem extends ReviewTaskItem {}

export interface FindingListItem {
  id: string;
  title: string;
  project: string;
  risk: "高" | "中" | "低";
  category:
    | "资格条件"
    | "评标办法"
    | "保证金条款"
    | "商务条款"
    | "技术条款"
    | "时间节点"
    | "文件完整性"
    | "资格响应"
    | "技术响应"
    | "商务响应"
    | "附件材料"
    | "偏离风险"
    | "其他";
  location: string;
  status: "待复核" | "已确认" | "已忽略";
  description: string;
  recommendation: string;
  references: string[];
  sourceChunkIds: string[];
  candidateChunkIds: string[];
  regulationChunkIds: string[];
  needsHumanReview: boolean;
  confidence: number;
  sourceChunks: Array<{
    documentId: string;
    documentName: string;
    chunkId: string;
    order: number;
    text: string;
  }>;
  candidateChunks: Array<{
    documentId: string;
    documentName: string;
    chunkId: string;
    order: number;
    text: string;
  }>;
  regulationChunks: Array<{
    regulationId: string;
    regulationName: string;
    regulationCategory: string;
    chunkId: string;
    order: number;
    text: string;
    sectionTitle?: string;
  }>;
}

export interface RegulationSection {
  title: string;
  rules: number;
}

export interface RegulationItem {
  id: string;
  name: string;
  category: string;
  ruleCount: number;
  updated: string;
  textPreview: string;
  chunks: Array<{
    id: string;
    text: string;
    order: number;
    sectionTitle?: string;
  }>;
  sections: RegulationSection[];
}

export interface RegulationDraft {
  name: string;
  category: string;
  ruleCount: number;
  updated: string;
  textPreview: string;
  chunks: Array<{
    id: string;
    text: string;
    order: number;
    sectionId?: string;
  }>;
  sections: RegulationSection[];
  aiRefined?: {
    applied: boolean;
    changedFields: string[];
  };
}
