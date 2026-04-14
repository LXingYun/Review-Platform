import { parseNumber } from "./ai-config-service";
import { getRuntimeHealthSampler } from "./runtime-health-sampler";

interface Waiter {
  taskId: string;
  resolve: (lease: AiInFlightLease) => void;
  reject: (error: Error) => void;
}

const defaultMaxInFlight = Math.floor(
  parseNumber({
    value: process.env.REVIEW_GLOBAL_MAX_AI_INFLIGHT,
    fallback: 24,
    min: 1,
    max: 128,
  }),
);

const defaultMinInFlight = Math.floor(
  parseNumber({
    value: process.env.REVIEW_GLOBAL_MIN_AI_INFLIGHT,
    fallback: 8,
    min: 1,
    max: defaultMaxInFlight,
  }),
);

const defaultPerTaskMaxInFlight = Math.floor(
  parseNumber({
    value: process.env.REVIEW_PER_TASK_MAX_AI_INFLIGHT,
    fallback: 8,
    min: 1,
    max: defaultMaxInFlight,
  }),
);

const toAbortError = () => {
  const error = new Error("aborted");
  error.name = "AbortError";
  return error;
};

export interface AiInFlightLease {
  taskId: string;
  release: () => void;
}

export interface AiInFlightLimiterStats {
  inFlightTotal: number;
  globalLimit: number;
  perTaskLimit: number;
  queuedWaiters: number;
  inFlightByTask: Record<string, number>;
}

export class AiInFlightLimiter {
  private readonly maxGlobalLimit: number;
  private readonly minGlobalLimit: number;
  private readonly perTaskLimit: number;
  private globalLimit: number;

  private inFlightTotal = 0;
  private readonly inFlightByTask = new Map<string, number>();
  private readonly waitQueue: Waiter[] = [];

  constructor(params: {
    maxGlobalLimit?: number;
    minGlobalLimit?: number;
    perTaskLimit?: number;
  } = {}) {
    this.maxGlobalLimit = Math.max(1, Math.floor(params.maxGlobalLimit ?? defaultMaxInFlight));
    this.minGlobalLimit = Math.max(
      1,
      Math.min(this.maxGlobalLimit, Math.floor(params.minGlobalLimit ?? defaultMinInFlight)),
    );
    this.perTaskLimit = Math.max(1, Math.min(this.maxGlobalLimit, Math.floor(params.perTaskLimit ?? defaultPerTaskMaxInFlight)));
    this.globalLimit = this.maxGlobalLimit;
  }

  acquire = async (params: {
    taskId?: string;
    signal?: AbortSignal;
  }): Promise<AiInFlightLease> => {
    const taskId = params.taskId?.trim() ? params.taskId : "__global__";

    if (params.signal?.aborted) {
      throw toAbortError();
    }

    return await new Promise<AiInFlightLease>((resolve, reject) => {
      const waiter: Waiter = {
        taskId,
        resolve,
        reject,
      };

      const onAbort = () => {
        const index = this.waitQueue.indexOf(waiter);
        if (index >= 0) {
          this.waitQueue.splice(index, 1);
        }
        reject(toAbortError());
      };

      if (params.signal) {
        params.signal.addEventListener("abort", onAbort, { once: true });
      }

      const wrappedResolve = (lease: AiInFlightLease) => {
        if (params.signal) {
          params.signal.removeEventListener("abort", onAbort);
        }
        resolve(lease);
      };

      waiter.resolve = wrappedResolve;
      this.waitQueue.push(waiter);
      this.pumpQueue();
    });
  };

  setGlobalLimit = (value: number) => {
    this.globalLimit = Math.max(this.minGlobalLimit, Math.min(this.maxGlobalLimit, Math.floor(value)));
    this.pumpQueue();
  };

  resetGlobalLimit = () => {
    this.globalLimit = this.maxGlobalLimit;
    this.pumpQueue();
  };

  getStats = (): AiInFlightLimiterStats => ({
    inFlightTotal: this.inFlightTotal,
    globalLimit: this.globalLimit,
    perTaskLimit: this.perTaskLimit,
    queuedWaiters: this.waitQueue.length,
    inFlightByTask: Object.fromEntries(this.inFlightByTask.entries()),
  });

  private canGrant = (taskId: string) => {
    if (this.inFlightTotal >= this.globalLimit) return false;
    const currentTaskInFlight = this.inFlightByTask.get(taskId) ?? 0;
    return currentTaskInFlight < this.perTaskLimit;
  };

  private grant = (taskId: string): AiInFlightLease => {
    this.inFlightTotal += 1;
    this.inFlightByTask.set(taskId, (this.inFlightByTask.get(taskId) ?? 0) + 1);
    getRuntimeHealthSampler().setAiInFlight(this.inFlightTotal);

    let released = false;
    return {
      taskId,
      release: () => {
        if (released) return;
        released = true;

        this.inFlightTotal = Math.max(0, this.inFlightTotal - 1);
        const current = this.inFlightByTask.get(taskId) ?? 0;
        if (current <= 1) {
          this.inFlightByTask.delete(taskId);
        } else {
          this.inFlightByTask.set(taskId, current - 1);
        }

        getRuntimeHealthSampler().setAiInFlight(this.inFlightTotal);
        this.pumpQueue();
      },
    };
  };

  private pumpQueue = () => {
    if (this.waitQueue.length === 0) return;

    let madeProgress = true;
    while (madeProgress && this.waitQueue.length > 0) {
      madeProgress = false;

      for (let index = 0; index < this.waitQueue.length; index += 1) {
        const waiter = this.waitQueue[index];
        if (!this.canGrant(waiter.taskId)) {
          continue;
        }

        this.waitQueue.splice(index, 1);
        waiter.resolve(this.grant(waiter.taskId));
        madeProgress = true;
        break;
      }
    }
  };
}

let sharedAiInFlightLimiter: AiInFlightLimiter | null = null;

export const getSharedAiInFlightLimiter = () => {
  if (!sharedAiInFlightLimiter) {
    sharedAiInFlightLimiter = new AiInFlightLimiter();
  }

  return sharedAiInFlightLimiter;
};
