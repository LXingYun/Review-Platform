import { monitorEventLoopDelay } from "node:perf_hooks";
import { isRateLimitedAiError } from "./ai-retry-service";

const defaultPressureWindowMs = 60_000;
const defaultRecoveryWindowMs = 10 * 60_000;
const defaultPressureRateThreshold = 0.05;
const defaultRecoveryRateThreshold = 0.01;
const defaultPressureWindowMinimumAttempts = 5;
const defaultMaxRssBytes = 1_600 * 1024 * 1024;
const defaultMaxEventLoopLagMs = 150;

export interface ChapterConcurrencyController {
  getCurrentConcurrency: () => number;
  recordSuccess: (params?: { hadRateLimitRetry?: boolean }) => void;
  recordFailure: (error: unknown) => void;
}

interface ChapterAttempt {
  timestamp: number;
  rateLimited: boolean;
}

interface RuntimeMetrics {
  rssBytes: number;
  eventLoopLagMs: number;
}

let eventLoopLagMonitor: ReturnType<typeof monitorEventLoopDelay> | null = null;

const toAbortError = () => {
  const error = new Error("aborted");
  error.name = "AbortError";
  return error;
};

const createCombinedAbortSignal = (signals: AbortSignal[]) => {
  if (signals.length === 0) {
    return undefined;
  }

  const controller = new AbortController();
  const onAbort = (event: Event) => {
    const signal = event.target as AbortSignal;
    if (!controller.signal.aborted) {
      controller.abort(signal.reason);
    }
  };

  signals.forEach((signal) => {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });

  return controller.signal;
};

const getDefaultRuntimeMetrics = (): RuntimeMetrics => {
  const rssBytes = process.memoryUsage().rss;

  let eventLoopLagMs = 0;
  try {
    if (!eventLoopLagMonitor) {
      eventLoopLagMonitor = monitorEventLoopDelay({ resolution: 20 });
      eventLoopLagMonitor.enable();
    }

    const percentile95 = eventLoopLagMonitor.percentile(95);
    eventLoopLagMs = Number.isFinite(percentile95) ? percentile95 / 1_000_000 : 0;
    eventLoopLagMonitor.reset();
  } catch {
    eventLoopLagMs = 0;
  }

  return {
    rssBytes,
    eventLoopLagMs,
  };
};

export const createReviewChapterConcurrencyController = (params: {
  initialConcurrency: number;
  minConcurrency: number;
  now?: () => number;
  getRuntimeMetrics?: () => RuntimeMetrics;
  pressureWindowMs?: number;
  recoveryWindowMs?: number;
  pressureRateThreshold?: number;
  recoveryRateThreshold?: number;
  maxRssBytes?: number;
  maxEventLoopLagMs?: number;
}): ChapterConcurrencyController => {
  const now = params.now ?? (() => Date.now());
  const getRuntimeMetrics = params.getRuntimeMetrics ?? getDefaultRuntimeMetrics;
  const pressureWindowMs = params.pressureWindowMs ?? defaultPressureWindowMs;
  const recoveryWindowMs = params.recoveryWindowMs ?? defaultRecoveryWindowMs;
  const pressureRateThreshold = params.pressureRateThreshold ?? defaultPressureRateThreshold;
  const recoveryRateThreshold = params.recoveryRateThreshold ?? defaultRecoveryRateThreshold;
  const pressureWindowMinimumAttempts = defaultPressureWindowMinimumAttempts;
  const maxRssBytes = params.maxRssBytes ?? defaultMaxRssBytes;
  const maxEventLoopLagMs = params.maxEventLoopLagMs ?? defaultMaxEventLoopLagMs;

  const initialConcurrency = Math.max(1, params.initialConcurrency);
  const minConcurrency = Math.max(1, Math.min(initialConcurrency, params.minConcurrency));

  let currentConcurrency = initialConcurrency;
  let downgradedAt: number | null = null;
  let consecutiveRateLimitedFailures = 0;
  const attempts: ChapterAttempt[] = [];

  const trimAttempts = (windowMs: number) => {
    const cutoff = now() - windowMs;
    while (attempts.length > 0 && attempts[0].timestamp < cutoff) {
      attempts.shift();
    }
  };

  const getWindowStats = (windowMs: number) => {
    trimAttempts(windowMs);
    if (attempts.length === 0) {
      return {
        attempts: 0,
        ratio: 0,
      };
    }

    const rateLimitedCount = attempts.filter((item) => item.rateLimited).length;
    return {
      attempts: attempts.length,
      ratio: rateLimitedCount / attempts.length,
    };
  };

  const hasResourcePressure = () => {
    const metrics = getRuntimeMetrics();
    return metrics.rssBytes > maxRssBytes || metrics.eventLoopLagMs > maxEventLoopLagMs;
  };

  const maybeAdjustConcurrency = () => {
    if (hasResourcePressure() && currentConcurrency > minConcurrency) {
      currentConcurrency = minConcurrency;
      downgradedAt = now();
      return;
    }

    const pressureStats = getWindowStats(pressureWindowMs);
    const shouldDowngradeByRatio =
      pressureStats.attempts >= pressureWindowMinimumAttempts && pressureStats.ratio > pressureRateThreshold;
    const shouldDowngrade = consecutiveRateLimitedFailures >= 2 || shouldDowngradeByRatio;

    if (shouldDowngrade && currentConcurrency > minConcurrency) {
      currentConcurrency = minConcurrency;
      downgradedAt = now();
      return;
    }

    if (currentConcurrency >= initialConcurrency || downgradedAt === null) {
      return;
    }

    const recoveredForEnoughTime = now() - downgradedAt >= recoveryWindowMs;
    if (!recoveredForEnoughTime || hasResourcePressure()) {
      return;
    }

    const recoveryStats = getWindowStats(recoveryWindowMs);
    if (recoveryStats.ratio < recoveryRateThreshold) {
      currentConcurrency = initialConcurrency;
      downgradedAt = null;
      consecutiveRateLimitedFailures = 0;
    }
  };

  const recordAttempt = (rateLimited: boolean) => {
    attempts.push({
      timestamp: now(),
      rateLimited,
    });
    trimAttempts(recoveryWindowMs);
  };

  return {
    getCurrentConcurrency: () => {
      maybeAdjustConcurrency();
      return currentConcurrency;
    },
    recordSuccess: (success = {}) => {
      const rateLimited = success.hadRateLimitRetry === true;
      recordAttempt(rateLimited);
      consecutiveRateLimitedFailures = 0;
      maybeAdjustConcurrency();
    },
    recordFailure: (error: unknown) => {
      const rateLimited = isRateLimitedAiError(error);
      recordAttempt(rateLimited);
      consecutiveRateLimitedFailures = rateLimited ? consecutiveRateLimitedFailures + 1 : 0;
      maybeAdjustConcurrency();
    },
  };
};

export const runWithAdaptiveChapterConcurrency = async <TItem, TResult>(params: {
  items: TItem[];
  controller: ChapterConcurrencyController;
  worker: (params: {
    item: TItem;
    index: number;
    signal?: AbortSignal;
  }) => Promise<TResult>;
  signal?: AbortSignal;
  getSuccessMetrics?: (result: TResult) => {
    hadRateLimitRetry?: boolean;
  };
  collectResults?: boolean;
  onItemSuccess?: (params: {
    item: TItem;
    index: number;
    result: TResult;
    completed: number;
    total: number;
    currentConcurrency: number;
  }) => void;
  onItemCompleted?: (params: {
    item: TItem;
    index: number;
    completed: number;
    total: number;
    currentConcurrency: number;
  }) => void;
}): Promise<TResult[]> => {
  if (params.items.length === 0) {
    return [];
  }

  const externalSignal = params.signal;
  const internalAbortController = new AbortController();
  const signal = createCombinedAbortSignal(
    [externalSignal, internalAbortController.signal].filter((item): item is AbortSignal => Boolean(item)),
  );
  const shouldCollectResults = params.collectResults !== false;

  return await new Promise<TResult[]>((resolve, reject) => {
    const results = shouldCollectResults ? new Array<TResult>(params.items.length) : [];
    let nextIndex = 0;
    let activeCount = 0;
    let completedCount = 0;
    let settled = false;
    let firstError: unknown = null;

    const settleWithError = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const settleWithSuccess = () => {
      if (settled) return;
      settled = true;
      resolve(results as TResult[]);
    };

    const pumpQueue = () => {
      if (settled) return;

      if (firstError) {
        if (activeCount === 0) {
          settleWithError(firstError);
        }
        return;
      }

      if (externalSignal?.aborted) {
        settleWithError(toAbortError());
        return;
      }

      if (completedCount >= params.items.length && activeCount === 0) {
        settleWithSuccess();
        return;
      }

      const targetConcurrency = params.controller.getCurrentConcurrency();
      while (activeCount < targetConcurrency && nextIndex < params.items.length) {
        const index = nextIndex;
        nextIndex += 1;
        activeCount += 1;

        void params.worker({
          item: params.items[index],
          index,
          signal,
        })
          .then((result) => {
            if (settled) return;

            if (shouldCollectResults) {
              results[index] = result;
            }
            completedCount += 1;
            activeCount -= 1;

            const metrics = params.getSuccessMetrics?.(result);
            const currentConcurrency = params.controller.getCurrentConcurrency();
            params.controller.recordSuccess({
              hadRateLimitRetry: metrics?.hadRateLimitRetry,
            });
            params.onItemSuccess?.({
              item: params.items[index],
              index,
              result,
              completed: completedCount,
              total: params.items.length,
              currentConcurrency,
            });

            params.onItemCompleted?.({
              item: params.items[index],
              index,
              completed: completedCount,
              total: params.items.length,
              currentConcurrency,
            });

            pumpQueue();
          })
          .catch((error) => {
            if (settled) return;

            activeCount -= 1;
            params.controller.recordFailure(error);

            if (!firstError) {
              firstError = error;
              internalAbortController.abort(error);
            }

            pumpQueue();
          });
      }
    };

    externalSignal?.addEventListener(
      "abort",
      () => {
        if (!settled) {
          settleWithError(toAbortError());
        }
      },
      { once: true },
    );

    pumpQueue();
  });
};
