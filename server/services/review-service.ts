import type { ReviewConsistencyMode, ReviewScenario, ReviewTask } from "../types";
import { store } from "../store";
import { createId, nowIso } from "../utils";
import { getAiConfig } from "./ai-config-service";
import {
  assertProjectAccess,
  assertTaskAccess,
  getAccessibleProjectIdSet,
  resolveActor,
} from "./access-control-service";
import type { AuthActor } from "./auth-types";
import { notFound } from "./http-error";
import {
  buildConsistencyFingerprint,
  buildScenarioPromptVersion,
} from "./review-consistency-service";
import { resolveTaskRegulationContext } from "./review-context-service";
import { getSharedReviewTaskDispatcher } from "./review-task-dispatcher";
import {
  buildReviewTaskName,
  reviewRiskLevelText,
  reviewTaskMessages,
  reviewTaskStatusText,
} from "./review-task-messages";
import { getSharedReviewTaskRepository } from "./review-task-repository";
import { getSharedReviewTaskRunner } from "./review-task-runner";
import { getReviewTaskStageLabel } from "./review-task-stage-service";

const reviewTaskRepository = getSharedReviewTaskRepository();
const reviewTaskRunner = getSharedReviewTaskRunner();
const reviewTaskDispatcher = getSharedReviewTaskDispatcher();

const validateTaskDocuments = (projectId: string, documentIds: string[]) => {
  const uniqueDocumentIds = Array.from(new Set(documentIds));
  const data = store.get();
  const matchedDocuments = uniqueDocumentIds
    .map((documentId) => data.documents.find((item) => item.id === documentId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (matchedDocuments.length !== uniqueDocumentIds.length) {
    throw notFound("Document not found.");
  }

  if (!matchedDocuments.every((document) => document.projectId === projectId)) {
    throw notFound("Document not found.");
  }
};

export const resolveReviewExecutionMode = (params: {
  aiEnabled: boolean;
}) => (params.aiEnabled ? "ai" : "blocked");

export const initializeReviewWorkers = () => {
  reviewTaskDispatcher.initialize();
  reviewTaskDispatcher.schedule();
};

export const listTasks = (projectId?: string, actor?: AuthActor) => {
  const accessActor = resolveActor(actor);
  const data = store.get();
  if (projectId) {
    assertProjectAccess(accessActor, projectId, data);
  }

  const accessibleProjectIds = getAccessibleProjectIdSet(accessActor, data);
  return reviewTaskRepository
    .listTasks(projectId)
    .filter((task) => accessibleProjectIds.has(task.projectId));
};

export const getTask = (taskId: string, actor?: AuthActor) => {
  const accessActor = resolveActor(actor);
  const data = store.get();
  assertTaskAccess(accessActor, taskId, data);
  return reviewTaskRepository.getTask(taskId);
};

export const createReviewTask = async (params: {
  projectId: string;
  scenario: ReviewScenario;
  documentIds: string[];
  regulationIds?: string[];
  consistencyMode?: ReviewConsistencyMode;
  actor?: AuthActor;
}) => {
  const accessActor = resolveActor(params.actor);
  const data = store.get();
  assertProjectAccess(accessActor, params.projectId, data);
  validateTaskDocuments(params.projectId, params.documentIds);

  const aiConfig = getAiConfig();
  if (!aiConfig.enabled) {
    throw new Error(reviewTaskMessages.aiConfigRequired);
  }

  const creationContext = reviewTaskRepository.getTaskCreationContext({
    projectId: params.projectId,
    documentIds: params.documentIds,
  });
  if (!creationContext.project) {
    throw new Error(reviewTaskMessages.projectNotFound);
  }
  if (creationContext.taskDocuments.length !== params.documentIds.length) {
    throw new Error(reviewTaskMessages.noDocuments);
  }

  const taskName = buildReviewTaskName({
    scenario: params.scenario,
    projectName: creationContext.project.name,
  });
  const regulationContext = resolveTaskRegulationContext({
    scenario: params.scenario,
    availableRegulations: creationContext.availableRegulations,
    requestedRegulationIds: params.regulationIds,
  });
  const defaultConsistencyMode =
    process.env.REVIEW_DEFAULT_CONSISTENCY_MODE === "strict" ? "strict" : "balanced";
  const consistencyMode = params.consistencyMode ?? defaultConsistencyMode;
  const consistencyFingerprint = buildConsistencyFingerprint({
    scenario: params.scenario,
    consistencyMode,
    documents: creationContext.taskDocuments,
    regulations: regulationContext.regulationSnapshot ?? [],
    model: aiConfig.model,
    promptVersion: buildScenarioPromptVersion(params.scenario),
  });

  const task: ReviewTask = {
    id: createId("task"),
    projectId: creationContext.project.id,
    scenario: params.scenario,
    consistencyMode,
    consistencyFingerprint,
    name: taskName,
    status: reviewTaskStatusText.queued,
    stage: "queued",
    stageLabel: getReviewTaskStageLabel("queued"),
    progress: 0,
    riskLevel: reviewRiskLevelText.low,
    documentIds: params.documentIds,
    ...regulationContext,
    attemptCount: 1,
    createdAt: nowIso(),
    completedAt: null,
  };

  reviewTaskRepository.createTaskRecord(task);
  reviewTaskDispatcher.syncRuntimeQueueState();
  reviewTaskDispatcher.schedule();

  return {
    task: reviewTaskRepository.toPublicTask(task),
    findings: [],
    project: creationContext.project,
  };
};

export const retryReviewTask = (taskId: string, actor?: AuthActor) => {
  const accessActor = resolveActor(actor);
  const data = store.get();
  assertTaskAccess(accessActor, taskId, data);

  const result = reviewTaskRepository.retryTask(taskId);
  reviewTaskDispatcher.syncRuntimeQueueState();
  reviewTaskDispatcher.schedule();
  return result;
};

export const abortReviewTask = (taskId: string, actor?: AuthActor) => {
  const accessActor = resolveActor(actor);
  const data = store.get();
  assertTaskAccess(accessActor, taskId, data);

  reviewTaskRunner.abortTask(taskId);
  const result = reviewTaskRepository.abortTask(taskId);
  reviewTaskDispatcher.syncRuntimeQueueState();
  reviewTaskDispatcher.schedule();
  return result;
};

export const deleteReviewTask = (taskId: string, actor?: AuthActor) => {
  const accessActor = resolveActor(actor);
  const data = store.get();
  assertTaskAccess(accessActor, taskId, data);

  reviewTaskRunner.abortTask(taskId);
  const result = reviewTaskRepository.deleteTask(taskId);
  reviewTaskDispatcher.syncRuntimeQueueState();
  reviewTaskDispatcher.schedule();
  return result;
};
