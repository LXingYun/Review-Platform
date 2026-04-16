import type { ReviewConsistencyMode, ReviewScenario, ReviewTask } from "../types";
import { createId, nowIso } from "../utils";
import { getAiConfig } from "./ai-config-service";
import {
  buildConsistencyFingerprint,
  buildScenarioPromptVersion,
} from "./review-consistency-service";
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
import { resolveTaskRegulationContext } from "./review-context-service";

const reviewTaskRepository = getSharedReviewTaskRepository();
const reviewTaskRunner = getSharedReviewTaskRunner();
const reviewTaskDispatcher = getSharedReviewTaskDispatcher();

export const resolveReviewExecutionMode = (params: {
  aiEnabled: boolean;
}) => (params.aiEnabled ? "ai" : "blocked");

export const initializeReviewWorkers = () => {
  reviewTaskDispatcher.initialize();
  reviewTaskDispatcher.schedule();
};

export const listTasks = (projectId?: string) => reviewTaskRepository.listTasks(projectId);

export const getTask = (taskId: string) => reviewTaskRepository.getTask(taskId);

export const createReviewTask = async (params: {
  projectId: string;
  scenario: ReviewScenario;
  documentIds: string[];
  regulationIds?: string[];
  consistencyMode?: ReviewConsistencyMode;
}) => {
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
  if (creationContext.taskDocuments.length === 0) {
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

export const retryReviewTask = (taskId: string) => {
  const result = reviewTaskRepository.retryTask(taskId);
  reviewTaskDispatcher.syncRuntimeQueueState();
  reviewTaskDispatcher.schedule();
  return result;
};

export const abortReviewTask = (taskId: string) => {
  reviewTaskRunner.abortTask(taskId);
  const result = reviewTaskRepository.abortTask(taskId);
  reviewTaskDispatcher.syncRuntimeQueueState();
  reviewTaskDispatcher.schedule();
  return result;
};

export const deleteReviewTask = (taskId: string) => {
  reviewTaskRunner.abortTask(taskId);
  const result = reviewTaskRepository.deleteTask(taskId);
  reviewTaskDispatcher.syncRuntimeQueueState();
  reviewTaskDispatcher.schedule();
  return result;
};
