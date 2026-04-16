import type {
  DocumentRecord,
  Finding,
  Project,
  Regulation,
  RegulationSection,
  ReviewTask,
  ReviewTaskStage,
  ReviewTaskStatus,
  RiskLevel,
  UserRole,
} from "./domain";

export interface DashboardStat {
  label: string;
  value: string;
  color: string;
}

export interface DashboardTask {
  id: string;
  name: string;
  status: ReviewTaskStatus;
  stage: ReviewTaskStage;
  stageLabel: string;
  risk: RiskLevel;
  progress: number;
}

export interface DashboardResponse {
  stats: DashboardStat[];
  recentTasks: DashboardTask[];
}

export interface AuthUserInfo {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface AuthLoginResponse {
  token: string;
  expiresAt: string;
  user: AuthUserInfo;
}

export interface AuthMeResponse {
  user: AuthUserInfo;
}

export interface AdminUsersResponse {
  users: AuthUserInfo[];
}

export type ProjectListItem = Project & {
  taskCount: number;
  issueCount: number;
  date: string;
  latestReviewCompletedAt: string | null;
};

export type ProjectDetailItem = ProjectListItem;

export type DocumentItem = DocumentRecord;

export interface ReviewTaskResult {
  task: Pick<ReviewTask, "id" | "name" | "status" | "progress" | "attemptCount"> & {
    riskLevel: RiskLevel;
  };
  findings: Array<Pick<Finding, "id" | "title" | "risk">>;
}

export type ReviewTaskItem = ReviewTask & {
  projectName: string;
};

export type ReviewTaskDetailItem = ReviewTaskItem;

export interface FindingDocumentChunkReference {
  documentId: string;
  documentName: string;
  chunkId: string;
  order: number;
  text: string;
}

export interface FindingRegulationChunkReference {
  regulationId: string;
  regulationName: string;
  regulationCategory: string;
  chunkId: string;
  order: number;
  text: string;
  sectionTitle?: string;
}

export type FindingListItem = Finding & {
  project: string;
  sourceChunks: FindingDocumentChunkReference[];
  candidateChunks: FindingDocumentChunkReference[];
  regulationChunks: FindingRegulationChunkReference[];
};

export type RegulationItem = Regulation;

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
    sectionTitle?: string;
  }>;
  sections: RegulationSection[];
  aiRefined?: {
    applied: boolean;
    changedFields: string[];
  };
}
