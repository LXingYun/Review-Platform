import { z } from "zod";

export const reviewScenarioSchema = z.enum(["tender_compliance", "bid_consistency"]);
export const reviewTaskStatusSchema = z.enum(["待审核", "进行中", "已完成", "失败", "未完成"]);
export const reviewTaskStageSchema = z.enum([
  "queued",
  "preparing_context",
  "ai_review",
  "chapter_review",
  "cross_section_review",
  "consolidating",
  "completed",
  "failed",
  "aborted",
  "interrupted",
]);
export const riskLevelSchema = z.enum(["高", "中", "低"]);
export const findingStatusSchema = z.enum(["待复核", "已确认", "已忽略"]);
export const findingReviewStageSchema = z.enum([
  "chapter_review",
  "cross_section_review",
  "response_consistency_review",
]);
export const findingCategorySchema = z.enum([
  "资格条件",
  "评标办法",
  "保证金条款",
  "商务条款",
  "技术条款",
  "时间节点",
  "文件完整性",
  "其他",
  "资格响应",
  "技术响应",
  "商务响应",
  "附件材料",
  "偏离风险",
]);

const findingReviewLogSchema = z.object({
  id: z.string(),
  action: z.enum(["comment", "confirm", "ignore"]),
  status: findingStatusSchema.optional(),
  note: z.string(),
  reviewer: z.string(),
  createdAt: z.string(),
});

const findingDocumentChunkReferenceSchema = z.object({
  documentId: z.string(),
  documentName: z.string(),
  chunkId: z.string(),
  order: z.number().int().positive(),
  text: z.string(),
});

const findingRegulationChunkReferenceSchema = z.object({
  regulationId: z.string(),
  regulationName: z.string(),
  regulationCategory: z.string(),
  chunkId: z.string(),
  order: z.number().int().positive(),
  text: z.string(),
  sectionTitle: z.string().optional(),
});

const reviewTaskDetailItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  scenario: reviewScenarioSchema,
  name: z.string(),
  status: reviewTaskStatusSchema,
  stage: reviewTaskStageSchema,
  stageLabel: z.string(),
  progress: z.number().min(0).max(100),
  riskLevel: riskLevelSchema,
  documentIds: z.array(z.string()),
  attemptCount: z.number().int().positive(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
  projectName: z.string(),
});

const findingListItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  taskId: z.string(),
  title: z.string(),
  category: findingCategorySchema,
  risk: riskLevelSchema,
  status: findingStatusSchema,
  location: z.string(),
  description: z.string(),
  recommendation: z.string(),
  references: z.array(z.string()),
  sourceChunkIds: z.array(z.string()),
  candidateChunkIds: z.array(z.string()),
  regulationChunkIds: z.array(z.string()),
  needsHumanReview: z.boolean(),
  confidence: z.number().min(0).max(1),
  reviewStage: findingReviewStageSchema,
  scenario: reviewScenarioSchema,
  reviewLogs: z.array(findingReviewLogSchema),
  createdAt: z.string(),
  project: z.string(),
  sourceChunks: z.array(findingDocumentChunkReferenceSchema),
  candidateChunks: z.array(findingDocumentChunkReferenceSchema),
  regulationChunks: z.array(findingRegulationChunkReferenceSchema),
});

const reviewTaskSseEnvelopeBaseSchema = z.object({
  version: z.literal(1),
  stream: z.literal("review-task"),
  type: z.enum(["snapshot", "task-updated", "finding-created", "heartbeat", "stream-error"]),
  taskId: z.string().min(1),
  seq: z.number().int().positive(),
  emittedAt: z.string(),
});

export const reviewTaskSseSnapshotEventSchema = reviewTaskSseEnvelopeBaseSchema.extend({
  type: z.literal("snapshot"),
  payload: z.object({
    task: reviewTaskDetailItemSchema,
    findings: z.array(findingListItemSchema),
  }),
});

export const reviewTaskSseTaskUpdatedEventSchema = reviewTaskSseEnvelopeBaseSchema.extend({
  type: z.literal("task-updated"),
  payload: z.object({
    task: reviewTaskDetailItemSchema,
  }),
});

export const reviewTaskSseFindingCreatedEventSchema = reviewTaskSseEnvelopeBaseSchema.extend({
  type: z.literal("finding-created"),
  payload: z.object({
    finding: findingListItemSchema,
  }),
});

export const reviewTaskSseHeartbeatEventSchema = reviewTaskSseEnvelopeBaseSchema.extend({
  type: z.literal("heartbeat"),
  payload: z.object({
    at: z.string(),
  }),
});

export const reviewTaskSseStreamErrorEventSchema = reviewTaskSseEnvelopeBaseSchema.extend({
  type: z.literal("stream-error"),
  payload: z.object({
    message: z.string(),
  }),
});

export const reviewTaskSseEventSchemaByType = {
  snapshot: reviewTaskSseSnapshotEventSchema,
  "task-updated": reviewTaskSseTaskUpdatedEventSchema,
  "finding-created": reviewTaskSseFindingCreatedEventSchema,
  heartbeat: reviewTaskSseHeartbeatEventSchema,
  "stream-error": reviewTaskSseStreamErrorEventSchema,
} as const;

export const reviewTaskSseEventSchema = z.discriminatedUnion("type", [
  reviewTaskSseSnapshotEventSchema,
  reviewTaskSseTaskUpdatedEventSchema,
  reviewTaskSseFindingCreatedEventSchema,
  reviewTaskSseHeartbeatEventSchema,
  reviewTaskSseStreamErrorEventSchema,
]);

export type ReviewTaskSseEventType = keyof typeof reviewTaskSseEventSchemaByType;
export type ReviewTaskSseEvent = z.infer<typeof reviewTaskSseEventSchema>;
export type ReviewTaskSseSnapshotEvent = z.infer<typeof reviewTaskSseSnapshotEventSchema>;
export type ReviewTaskSseTaskUpdatedEvent = z.infer<typeof reviewTaskSseTaskUpdatedEventSchema>;
export type ReviewTaskSseFindingCreatedEvent = z.infer<typeof reviewTaskSseFindingCreatedEventSchema>;
export type ReviewTaskSseHeartbeatEvent = z.infer<typeof reviewTaskSseHeartbeatEventSchema>;
export type ReviewTaskSseStreamErrorEvent = z.infer<typeof reviewTaskSseStreamErrorEventSchema>;
