CREATE TABLE `rel_document_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`chunk_order` integer NOT NULL,
	`text` text NOT NULL,
	`section_title` text,
	FOREIGN KEY (`document_id`) REFERENCES `rel_documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rel_document_chunks_document_id_idx` ON `rel_document_chunks` (`document_id`);--> statement-breakpoint
CREATE TABLE `rel_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`file_name` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`role` text NOT NULL,
	`storage_path` text NOT NULL,
	`parse_status` text NOT NULL,
	`page_count` integer NOT NULL,
	`parse_method` text NOT NULL,
	`text_preview` text NOT NULL,
	`extracted_text` text NOT NULL,
	`uploaded_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `rel_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rel_documents_project_id_idx` ON `rel_documents` (`project_id`);--> statement-breakpoint
CREATE TABLE `rel_finding_references` (
	`id` text PRIMARY KEY NOT NULL,
	`finding_id` text NOT NULL,
	`reference_type` text NOT NULL,
	`reference_value` text NOT NULL,
	`sort_order` integer NOT NULL,
	`payload_json` text,
	FOREIGN KEY (`finding_id`) REFERENCES `rel_findings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rel_finding_references_finding_id_idx` ON `rel_finding_references` (`finding_id`);--> statement-breakpoint
CREATE INDEX `rel_finding_references_type_idx` ON `rel_finding_references` (`reference_type`);--> statement-breakpoint
CREATE TABLE `rel_finding_review_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`finding_id` text NOT NULL,
	`action` text NOT NULL,
	`status` text,
	`note` text NOT NULL,
	`reviewer` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`finding_id`) REFERENCES `rel_findings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rel_finding_review_logs_finding_id_idx` ON `rel_finding_review_logs` (`finding_id`);--> statement-breakpoint
CREATE TABLE `rel_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`task_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`risk` text NOT NULL,
	`status` text NOT NULL,
	`location` text NOT NULL,
	`description` text NOT NULL,
	`recommendation` text NOT NULL,
	`needs_human_review` integer NOT NULL,
	`confidence` real NOT NULL,
	`review_stage` text NOT NULL,
	`scenario` text NOT NULL,
	`created_at` text NOT NULL,
	`metadata_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `rel_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `rel_review_tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rel_findings_project_id_idx` ON `rel_findings` (`project_id`);--> statement-breakpoint
CREATE INDEX `rel_findings_task_id_idx` ON `rel_findings` (`task_id`);--> statement-breakpoint
CREATE INDEX `rel_findings_status_idx` ON `rel_findings` (`status`);--> statement-breakpoint
CREATE TABLE `rel_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`description` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rel_regulation_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`regulation_id` text NOT NULL,
	`chunk_order` integer NOT NULL,
	`text` text NOT NULL,
	`section_title` text,
	FOREIGN KEY (`regulation_id`) REFERENCES `rel_regulations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rel_regulation_chunks_regulation_id_idx` ON `rel_regulation_chunks` (`regulation_id`);--> statement-breakpoint
CREATE TABLE `rel_regulation_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`regulation_id` text NOT NULL,
	`title` text NOT NULL,
	`rules` integer NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`regulation_id`) REFERENCES `rel_regulations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rel_regulation_sections_regulation_id_idx` ON `rel_regulation_sections` (`regulation_id`);--> statement-breakpoint
CREATE TABLE `rel_regulations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`rule_count` integer NOT NULL,
	`updated` text NOT NULL,
	`text_preview` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rel_review_task_documents` (
	`task_id` text NOT NULL,
	`document_id` text NOT NULL,
	PRIMARY KEY(`task_id`, `document_id`),
	FOREIGN KEY (`task_id`) REFERENCES `rel_review_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_id`) REFERENCES `rel_documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rel_review_task_documents_document_id_idx` ON `rel_review_task_documents` (`document_id`);--> statement-breakpoint
CREATE TABLE `rel_review_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`scenario` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`stage` text NOT NULL,
	`stage_label` text NOT NULL,
	`progress` integer NOT NULL,
	`risk_level` text NOT NULL,
	`attempt_count` integer NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `rel_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rel_review_tasks_project_id_idx` ON `rel_review_tasks` (`project_id`);