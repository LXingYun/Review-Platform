import type { Finding, ReviewTask } from "../types";
import { getAiConfig } from "./ai-config-service";
import { generateAiScenarioFindings } from "./ai-review-service";
import { normalizeGeneratedFindings } from "./finding-normalization-service";
import { getTaskRegulationsForExecution } from "./review-context-service";
import { getSharedReviewTaskRepository } from "./review-task-repository";
import {
  formatChapterReviewProgressLabel,
  formatReviewFailureMessage,
  reviewTaskMessages,
  reviewTaskStatusText,
} from "./review-task-messages";
import { getReviewTaskStageLabel } from "./review-task-stage-service";
import { toDeterministicSeed } from "./review-seed-service";
import { getRuntimeHealthSampler } from "./runtime-health-sampler";
import { generateTenderChapterAiFindings } from "./tender-ai-review-service";
import { summarizeRisk } from "../utils";
import {
  buildConsistencyFingerprint,
  buildConsistencyRunHash,
  buildScenarioPromptVersion,
  deriveDeterministicSeed,
} from "./review-consistency-service";

interface RunningTaskExecution {
  attemptCount: number;
  controller: AbortController;
}

const yieldToEventLoop = async () =>
  new Promise<void>((resolve) => {
    if (typeof setImmediate === "function") {
      setImmediate(resolve);
      return;
    }

    setTimeout(resolve, 0);
  });

/** Executes the lifecycle of a single review task. */
export class ReviewTaskRunner {
  private readonly runningControllers = new Map<string, RunningTaskExecution>();

  constructor(
    private readonly repository = getSharedReviewTaskRepository(),
    private readonly runtimeHealthSampler = getRuntimeHealthSampler(),
  ) {}

  abortTask(taskId: string) {
    const execution = this.runningControllers.get(taskId);
    execution?.controller.abort();
    this.runningControllers.delete(taskId);
  }

  async runReviewTask(taskId: string) {
    const task = this.repository.findTaskRecord(taskId);
    if (!task) return;

    const attemptCount = task.attemptCount;
    const execution = {
      attemptCount,
      controller: new AbortController(),
    };
    this.runningControllers.set(taskId, execution);

    try {
      const context = this.repository.getTaskExecutionContext(taskId);
      if (!context) {
        return;
      }

      if (!context.project) {
        this.repository.markTaskFailed(taskId, attemptCount, reviewTaskMessages.projectNotFound);
        return;
      }

      if (context.taskDocuments.length === 0) {
        this.repository.markTaskFailed(taskId, attemptCount, reviewTaskMessages.noDocuments);
        return;
      }

      const aiConfig = getAiConfig();
      if (!aiConfig.enabled) {
        throw new Error(reviewTaskMessages.aiConfigRequired);
      }

      const consistencyMode = context.task.consistencyMode ?? "balanced";
      const taskRegulations = getTaskRegulationsForExecution({
        task: context.task,
        availableRegulations: context.availableRegulations,
      });
      const consistencyFingerprint =
        context.task.consistencyFingerprint ??
        buildConsistencyFingerprint({
          scenario: context.task.scenario,
          consistencyMode,
          documents: context.taskDocuments,
          regulations: context.task.scenario === "tender_compliance" ? taskRegulations : [],
          model: aiConfig.model,
          promptVersion: buildScenarioPromptVersion(context.task.scenario),
        });
      const projectReviewSeed =
        consistencyMode === "strict"
          ? deriveDeterministicSeed(consistencyFingerprint)
          : toDeterministicSeed(context.project.id);

      const startedAt = Date.now();
      let findings: Finding[] = [];

      if (context.task.scenario === "tender_compliance") {
        this.repository.updateRunningTask(taskId, attemptCount, (currentTask) =>
          this.applyStage(currentTask, "chapter_review", { progress: 45 }),
        );

        const tenderDocument = context.taskDocuments.find((document) => document.role === "tender");
        if (!tenderDocument) {
          throw new Error(reviewTaskMessages.tenderDocumentRequired);
        }

        await yieldToEventLoop();

        const tenderResult = await generateTenderChapterAiFindings({
          projectId: context.project.id,
          taskId,
          tenderDocument,
          regulations: taskRegulations,
          chapterConcurrency: {
            initial: aiConfig.chapterReviewConcurrency,
            min:
              consistencyMode === "strict"
                ? aiConfig.chapterReviewConcurrency
                : aiConfig.chapterReviewMinConcurrency,
          },
          runtimeMetricsProvider: this.runtimeHealthSampler.getResourceMetrics,
          seed: projectReviewSeed,
          signal: execution.controller.signal,
          consistencyMode,
          consistencyFingerprint,
          onProgress: ({ current, total, chapterTitle, stage }) => {
            this.repository.updateRunningTask(taskId, attemptCount, (currentTask) =>
              this.applyStage(currentTask, stage === "chapter_review" ? "chapter_review" : "cross_section_review", {
                stageLabel:
                  stage === "chapter_review"
                    ? formatChapterReviewProgressLabel({
                        current,
                        total,
                        chapterTitle,
                      })
                    : getReviewTaskStageLabel("cross_section_review"),
                progress: stage === "chapter_review" ? 35 + Math.floor((current / total) * 35) : 78,
              }),
            );
          },
        });

        findings = tenderResult.findings;
      } else {
        this.repository.updateRunningTask(taskId, attemptCount, (currentTask) =>
          this.applyStage(currentTask, "ai_review", { progress: 45 }),
        );

        const tenderDocument = context.taskDocuments.find((document) => document.role === "tender");
        const bidDocument = context.taskDocuments.find((document) => document.role === "bid");
        if (!tenderDocument || !bidDocument) {
          throw new Error(reviewTaskMessages.bidDocumentsRequired);
        }

        findings = await generateAiScenarioFindings({
          scenario: context.task.scenario,
          projectId: context.project.id,
          taskId,
          documents: context.taskDocuments,
          regulations: taskRegulations,
          seed: projectReviewSeed,
          signal: execution.controller.signal,
          consistencyMode,
          consistencyFingerprint,
        });
      }

      if (!this.isTaskAttemptRunning(taskId, attemptCount)) {
        return;
      }

      const normalizedFindings = normalizeGeneratedFindings(findings);
      const riskLevel = summarizeRisk(normalizedFindings.map((finding) => finding.risk));
      const elapsed = Date.now() - startedAt;
      if (elapsed < aiConfig.reviewMinVisibleDurationMs) {
        this.repository.updateRunningTask(taskId, attemptCount, (currentTask) =>
          this.applyStage(currentTask, "consolidating", { progress: 80 }),
        );

        await new Promise((resolve) => setTimeout(resolve, aiConfig.reviewMinVisibleDurationMs - elapsed));
      }

      if (!this.isTaskAttemptRunning(taskId, attemptCount)) {
        return;
      }

      this.repository.completeTask({
        taskId,
        attemptCount,
        riskLevel,
        findings: normalizedFindings,
        consistencyRunHash: buildConsistencyRunHash(normalizedFindings),
      });
    } catch (error) {
      if (this.isTaskCancelled(taskId, attemptCount)) {
        this.repository.finalizeCancelledTask(taskId, attemptCount);
        return;
      }

      this.repository.markTaskFailed(taskId, attemptCount, formatReviewFailureMessage(error));
    } finally {
      const currentExecution = this.runningControllers.get(taskId);
      if (
        currentExecution &&
        currentExecution.attemptCount === execution.attemptCount &&
        currentExecution.controller === execution.controller
      ) {
        this.runningControllers.delete(taskId);
      }
    }
  }

  private isTaskCancelled(taskId: string, attemptCount: number) {
    const task = this.repository.findTaskRecord(taskId);
    return task?.attemptCount === attemptCount && task.status === reviewTaskStatusText.unfinished && task.stage === "aborted";
  }

  private isTaskAttemptRunning(taskId: string, attemptCount: number) {
    const task = this.repository.findTaskRecord(taskId);
    return task?.attemptCount === attemptCount && task.status === reviewTaskStatusText.running;
  }

  private applyStage(
    task: ReviewTask,
    stage: Parameters<typeof getReviewTaskStageLabel>[0],
    options: {
      stageLabel?: string;
      progress?: number;
    } = {},
  ) {
    return {
      ...task,
      stage,
      stageLabel: options.stageLabel ?? getReviewTaskStageLabel(stage),
      progress: options.progress ?? task.progress,
    };
  }
}

let sharedReviewTaskRunner: ReviewTaskRunner | null = null;

export const getSharedReviewTaskRunner = () => {
  if (!sharedReviewTaskRunner) {
    sharedReviewTaskRunner = new ReviewTaskRunner();
  }

  return sharedReviewTaskRunner;
};
