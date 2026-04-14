import { getReviewWorkerConcurrency } from "./ai-config-service";
import { getSharedGlobalLoadController } from "./global-load-controller";
import { getSharedReviewTaskRepository } from "./review-task-repository";
import { getSharedReviewTaskRunner } from "./review-task-runner";
import { getRuntimeHealthSampler } from "./runtime-health-sampler";

/** Coordinates queue draining and fair task activation. */
export class ReviewTaskDispatcher {
  private reviewWorkersStarted = false;
  private activeWorkers = 0;
  private drainScheduled = false;
  private queueCursor = 0;
  private dispatcherHeartbeatTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly repository = getSharedReviewTaskRepository(),
    private readonly runner = getSharedReviewTaskRunner(),
    private readonly globalLoadController = getSharedGlobalLoadController(),
    private readonly runtimeHealthSampler = getRuntimeHealthSampler(),
    private readonly workerConcurrency = getReviewWorkerConcurrency(),
  ) {}

  initialize() {
    if (this.reviewWorkersStarted) return;

    this.reviewWorkersStarted = true;
    this.runtimeHealthSampler.start();
    this.globalLoadController.start();
    this.repository.recoverInterruptedTasks();
    this.syncRuntimeQueueState();
    if (!this.dispatcherHeartbeatTimer) {
      this.dispatcherHeartbeatTimer = setInterval(() => {
        this.schedule();
      }, 1000);
      this.dispatcherHeartbeatTimer.unref?.();
    }
  }

  schedule() {
    if (this.drainScheduled) return;
    this.drainScheduled = true;

    this.scheduleMacrotask(() => {
      this.drainScheduled = false;
      void this.drainQueue();
    });
  }

  claimNextQueuedTask() {
    const { taskId, nextCursor } = this.repository.claimNextQueuedTask(this.queueCursor);
    this.queueCursor = nextCursor;
    return taskId;
  }

  syncRuntimeQueueState() {
    this.runtimeHealthSampler.setQueueState({
      activeTasks: this.activeWorkers,
      queuedTasks: this.repository.countQueuedTasks(),
    });
  }

  private async drainQueue() {
    this.syncRuntimeQueueState();
    if (this.globalLoadController.shouldPauseNewTasks()) {
      return;
    }

    const maxWorkers = Math.max(1, Math.min(this.workerConcurrency, this.globalLoadController.getActiveTaskLimit()));
    while (this.activeWorkers < maxWorkers) {
      const taskId = this.claimNextQueuedTask();
      if (!taskId) {
        this.syncRuntimeQueueState();
        return;
      }

      this.activeWorkers += 1;
      this.syncRuntimeQueueState();

      void this.runner.runReviewTask(taskId).finally(() => {
        this.activeWorkers -= 1;
        this.syncRuntimeQueueState();
        this.schedule();
      });
    }
  }

  private scheduleMacrotask(runner: () => void) {
    if (typeof setImmediate === "function") {
      setImmediate(runner);
      return;
    }

    setTimeout(runner, 0);
  }
}

let sharedReviewTaskDispatcher: ReviewTaskDispatcher | null = null;

export const getSharedReviewTaskDispatcher = () => {
  if (!sharedReviewTaskDispatcher) {
    sharedReviewTaskDispatcher = new ReviewTaskDispatcher();
  }

  return sharedReviewTaskDispatcher;
};
