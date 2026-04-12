import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type {
  FindingCategory,
  FindingReviewLog,
  FindingReviewStage,
  FindingStatus,
  ProjectReviewType,
  ProjectStatus,
  ReviewScenario,
  ReviewTaskStage,
  ReviewTaskStatus,
  RiskLevel,
} from "../types";

export const relMeta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const relProjects = sqliteTable("rel_projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").$type<ProjectReviewType>().notNull(),
  status: text("status").$type<ProjectStatus>().notNull(),
  description: text("description").notNull(),
  createdAt: text("created_at").notNull(),
});

export const relDocuments = sqliteTable(
  "rel_documents",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => relProjects.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    role: text("role").notNull(),
    storagePath: text("storage_path").notNull(),
    parseStatus: text("parse_status").notNull(),
    pageCount: integer("page_count").notNull(),
    parseMethod: text("parse_method").notNull(),
    textPreview: text("text_preview").notNull(),
    extractedText: text("extracted_text").notNull(),
    uploadedAt: text("uploaded_at").notNull(),
  },
  (table) => [index("rel_documents_project_id_idx").on(table.projectId)],
);

export const relDocumentChunks = sqliteTable(
  "rel_document_chunks",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => relDocuments.id, { onDelete: "cascade" }),
    chunkOrder: integer("chunk_order").notNull(),
    text: text("text").notNull(),
    sectionTitle: text("section_title"),
  },
  (table) => [index("rel_document_chunks_document_id_idx").on(table.documentId)],
);

export const relReviewTasks = sqliteTable(
  "rel_review_tasks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => relProjects.id, { onDelete: "cascade" }),
    scenario: text("scenario").$type<ReviewScenario>().notNull(),
    name: text("name").notNull(),
    status: text("status").$type<ReviewTaskStatus>().notNull(),
    stage: text("stage").$type<ReviewTaskStage>().notNull(),
    stageLabel: text("stage_label").notNull(),
    progress: integer("progress").notNull(),
    riskLevel: text("risk_level").$type<RiskLevel>().notNull(),
    attemptCount: integer("attempt_count").notNull(),
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [index("rel_review_tasks_project_id_idx").on(table.projectId)],
);

export const relReviewTaskDocuments = sqliteTable(
  "rel_review_task_documents",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => relReviewTasks.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => relDocuments.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.documentId] }),
    index("rel_review_task_documents_document_id_idx").on(table.documentId),
  ],
);

export const relFindings = sqliteTable(
  "rel_findings",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => relProjects.id, { onDelete: "cascade" }),
    taskId: text("task_id")
      .notNull()
      .references(() => relReviewTasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    category: text("category").$type<FindingCategory>().notNull(),
    risk: text("risk").$type<RiskLevel>().notNull(),
    status: text("status").$type<FindingStatus>().notNull(),
    location: text("location").notNull(),
    description: text("description").notNull(),
    recommendation: text("recommendation").notNull(),
    needsHumanReview: integer("needs_human_review", { mode: "boolean" }).notNull(),
    confidence: real("confidence").notNull(),
    reviewStage: text("review_stage").$type<FindingReviewStage>().notNull(),
    scenario: text("scenario").$type<ReviewScenario>().notNull(),
    createdAt: text("created_at").notNull(),
    metadataJson: text("metadata_json", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
  },
  (table) => [
    index("rel_findings_project_id_idx").on(table.projectId),
    index("rel_findings_task_id_idx").on(table.taskId),
    index("rel_findings_status_idx").on(table.status),
  ],
);

export const relFindingReferences = sqliteTable(
  "rel_finding_references",
  {
    id: text("id").primaryKey(),
    findingId: text("finding_id")
      .notNull()
      .references(() => relFindings.id, { onDelete: "cascade" }),
    referenceType: text("reference_type").notNull(),
    referenceValue: text("reference_value").notNull(),
    sortOrder: integer("sort_order").notNull(),
    payloadJson: text("payload_json", { mode: "json" }).$type<Record<string, unknown> | null>(),
  },
  (table) => [
    index("rel_finding_references_finding_id_idx").on(table.findingId),
    index("rel_finding_references_type_idx").on(table.referenceType),
  ],
);

export const relFindingReviewLogs = sqliteTable(
  "rel_finding_review_logs",
  {
    id: text("id").primaryKey(),
    findingId: text("finding_id")
      .notNull()
      .references(() => relFindings.id, { onDelete: "cascade" }),
    action: text("action").$type<FindingReviewLog["action"]>().notNull(),
    status: text("status").$type<FindingStatus>(),
    note: text("note").notNull(),
    reviewer: text("reviewer").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("rel_finding_review_logs_finding_id_idx").on(table.findingId)],
);

export const relRegulations = sqliteTable("rel_regulations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  ruleCount: integer("rule_count").notNull(),
  updated: text("updated").notNull(),
  textPreview: text("text_preview").notNull(),
});

export const relRegulationChunks = sqliteTable(
  "rel_regulation_chunks",
  {
    id: text("id").primaryKey(),
    regulationId: text("regulation_id")
      .notNull()
      .references(() => relRegulations.id, { onDelete: "cascade" }),
    chunkOrder: integer("chunk_order").notNull(),
    text: text("text").notNull(),
    sectionTitle: text("section_title"),
  },
  (table) => [index("rel_regulation_chunks_regulation_id_idx").on(table.regulationId)],
);

export const relRegulationSections = sqliteTable(
  "rel_regulation_sections",
  {
    id: text("id").primaryKey(),
    regulationId: text("regulation_id")
      .notNull()
      .references(() => relRegulations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    rules: integer("rules").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [index("rel_regulation_sections_regulation_id_idx").on(table.regulationId)],
);

export const relationalSchema = {
  relMeta,
  relProjects,
  relDocuments,
  relDocumentChunks,
  relReviewTasks,
  relReviewTaskDocuments,
  relFindings,
  relFindingReferences,
  relFindingReviewLogs,
  relRegulations,
  relRegulationChunks,
  relRegulationSections,
};
