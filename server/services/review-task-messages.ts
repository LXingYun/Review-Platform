import type { ReviewScenario, ReviewTaskStage } from "../types";

/** Canonical review task statuses used across backend services. */
export const reviewTaskStatusText = {
  queued: "\u5f85\u5ba1\u6838",
  running: "\u8fdb\u884c\u4e2d",
  completed: "\u5df2\u5b8c\u6210",
  failed: "\u5931\u8d25",
  unfinished: "\u672a\u5b8c\u6210",
} as const;

/** Canonical low risk label used when creating or retrying tasks. */
export const reviewRiskLevelText = {
  low: "\u4f4e",
} as const;

/** Human-readable stage labels shown in the UI. */
export const reviewTaskStageLabels: Record<ReviewTaskStage, string> = {
  queued: "\u7b49\u5f85\u540e\u53f0\u5904\u7406",
  preparing_context: "\u51c6\u5907\u5ba1\u6838\u4e0a\u4e0b\u6587",
  ai_review: "\u8fdb\u884c AI \u5ba1\u67e5",
  chapter_review: "\u8fdb\u884c\u7ae0\u8282\u7ea7\u5408\u89c4\u5ba1\u67e5",
  cross_section_review: "\u8fdb\u884c\u8de8\u7ae0\u8282\u4e00\u81f4\u6027\u68c0\u67e5",
  consolidating: "\u6574\u5408\u5ba1\u67e5\u7ed3\u679c",
  completed: "\u5ba1\u67e5\u5b8c\u6210",
  failed: "\u5ba1\u67e5\u5931\u8d25",
  aborted: "\u4efb\u52a1\u5df2\u4e2d\u6b62",
  interrupted: "\u670d\u52a1\u4e2d\u65ad\uff0c\u4efb\u52a1\u672a\u5b8c\u6210",
};

/** Standard task-related error and status messages. */
export const reviewTaskMessages = {
  aiReviewFailed: "AI \u5ba1\u67e5\u5931\u8d25",
  projectNotFound: "\u9879\u76ee\u4e0d\u5b58\u5728",
  noDocuments: "\u5ba1\u6838\u4efb\u52a1\u7f3a\u5c11\u53ef\u7528\u6587\u6863",
  tenderDocumentRequired: "\u62db\u6807\u5ba1\u67e5\u7f3a\u5c11\u62db\u6807\u6587\u4ef6",
  bidDocumentsRequired:
    "\u6295\u6807\u5ba1\u67e5\u9700\u8981\u540c\u65f6\u5305\u542b\u62db\u6807\u6587\u4ef6\u548c\u6295\u6807\u6587\u4ef6",
  taskNotFound: "\u5ba1\u67e5\u4efb\u52a1\u4e0d\u5b58\u5728",
  taskStillRunning: "\u5f53\u524d\u4efb\u52a1\u6b63\u5728\u6267\u884c\uff0c\u65e0\u6cd5\u91cd\u8bd5",
  taskCannotAbort: "\u5f53\u524d\u4efb\u52a1\u4e0d\u652f\u6301\u4e2d\u6b62",
  unknownProject: "\u672a\u77e5\u9879\u76ee",
  crossSectionScan: "\u8de8\u7ae0\u8282\u4e00\u81f4\u6027\u68c0\u67e5",
  aiConfigRequired: "AI \u5ba1\u67e5\u9700\u8981\u914d\u7f6e OPENAI_API_KEY",
} as const;

export const getReviewTaskStageLabelText = (stage: ReviewTaskStage) => reviewTaskStageLabels[stage];

export const buildReviewTaskName = (params: {
  scenario: ReviewScenario;
  projectName: string;
}) =>
  params.scenario === "tender_compliance"
    ? `${params.projectName}\u62db\u6807\u6587\u4ef6\u5ba1\u67e5`
    : `${params.projectName}\u6295\u6807\u6587\u4ef6\u5ba1\u67e5`;

export const formatChapterReviewProgressLabel = (params: {
  current: number;
  total: number;
  chapterTitle: string;
}) =>
  `\u6b63\u5728\u5ba1\u67e5 ${params.current}/${params.total} \u4e2a\u5ba1\u67e5\u5355\u5143\uff1a${params.chapterTitle}`;

export const formatReviewFailureMessage = (error: unknown) => {
  if (!(error instanceof Error)) {
    return reviewTaskMessages.aiReviewFailed;
  }

  const message = error.message.trim();
  if (!message) {
    return reviewTaskMessages.aiReviewFailed;
  }

  if (message.startsWith(reviewTaskMessages.aiReviewFailed)) {
    return message;
  }

  return `${reviewTaskMessages.aiReviewFailed}\uff1a${message}`;
};
