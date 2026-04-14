import { parseDurationMs, parseNumber } from "./ai-config-service";
import { getSharedAiInFlightLimiter } from "./ai-inflight-limiter";
import { getRuntimeHealthSampler, parseRateThreshold, type RuntimeWindowStats } from "./runtime-health-sampler";

export type RuntimeLoadStatus = "healthy" | "degraded" | "severe";

const parseIntSetting = (params: {
  value: string | undefined;
  fallback: number;
  min: number;
  max: number;
}) =>
  Math.floor(
    parseNumber({
      value: params.value,
      fallback: params.fallback,
      min: params.min,
      max: params.max,
    }),
  );

const defaultMaxActiveTasks = parseIntSetting({
  value: process.env.REVIEW_GLOBAL_MAX_ACTIVE_TASKS,
  fallback: 4,
  min: 1,
  max: 32,
});

const defaultDegradedMaxActiveTasks = parseIntSetting({
  value: process.env.REVIEW_GLOBAL_DEGRADED_MAX_ACTIVE_TASKS,
  fallback: Math.max(2, defaultMaxActiveTasks - 1),
  min: 1,
  max: defaultMaxActiveTasks,
});

const defaultSevereMaxActiveTasks = parseIntSetting({
  value: process.env.REVIEW_GLOBAL_SEVERE_MAX_ACTIVE_TASKS,
  fallback: 1,
  min: 1,
  max: defaultDegradedMaxActiveTasks,
});

const defaultHealthyAiInFlight = parseIntSetting({
  value: process.env.REVIEW_GLOBAL_MAX_AI_INFLIGHT,
  fallback: 24,
  min: 1,
  max: 256,
});

const defaultDegradedAiInFlight = parseIntSetting({
  value: process.env.REVIEW_GLOBAL_DEGRADED_AI_INFLIGHT,
  fallback: Math.max(12, defaultHealthyAiInFlight / 2),
  min: 1,
  max: defaultHealthyAiInFlight,
});

const defaultSevereAiInFlight = parseIntSetting({
  value: process.env.REVIEW_GLOBAL_MIN_AI_INFLIGHT,
  fallback: 8,
  min: 1,
  max: defaultDegradedAiInFlight,
});

const defaultCheckIntervalMs = parseDurationMs({
  value: process.env.RUNTIME_HEALTH_SAMPLE_INTERVAL_MS,
  fallback: 1_000,
  min: 250,
  max: 10_000,
});

const defaultWindowMs = parseDurationMs({
  value: process.env.RUNTIME_HEALTH_WINDOW_MS,
  fallback: 10 * 60_000,
  min: 60_000,
  max: 60 * 60_000,
});

const defaultDegradedLagP95Ms = parseNumber({
  value: process.env.RUNTIME_DEGRADED_EVENT_LOOP_P95_MS,
  fallback: 120,
  min: 50,
  max: 5_000,
});

const defaultSevereLagP95Ms = parseNumber({
  value: process.env.RUNTIME_SEVERE_EVENT_LOOP_P95_MS,
  fallback: 250,
  min: defaultDegradedLagP95Ms,
  max: 10_000,
});

const defaultDegradedTimeoutRate = parseRateThreshold({
  value: process.env.RUNTIME_DEGRADED_TIMEOUT_RATE,
  fallback: 0.02,
});

const defaultSevereTimeoutRate = parseRateThreshold({
  value: process.env.RUNTIME_SEVERE_TIMEOUT_RATE,
  fallback: 0.08,
});

const defaultDegradedHealthTimeoutRate = parseRateThreshold({
  value: process.env.RUNTIME_DEGRADED_HEALTH_TIMEOUT_RATE,
  fallback: 0.003,
});

const defaultSevereHealthTimeoutRate = parseRateThreshold({
  value: process.env.RUNTIME_SEVERE_HEALTH_TIMEOUT_RATE,
  fallback: 0.01,
});

interface GlobalLoadControllerState {
  status: RuntimeLoadStatus;
  updatedAt: string;
  reason: string;
  stats: RuntimeWindowStats;
}

export class GlobalLoadController {
  private readonly maxActiveTasks: number;
  private readonly degradedMaxActiveTasks: number;
  private readonly severeMaxActiveTasks: number;
  private readonly healthyAiInFlight: number;
  private readonly degradedAiInFlight: number;
  private readonly severeAiInFlight: number;
  private readonly checkIntervalMs: number;
  private readonly windowMs: number;
  private readonly degradedLagP95Ms: number;
  private readonly severeLagP95Ms: number;
  private readonly degradedTimeoutRate: number;
  private readonly severeTimeoutRate: number;
  private readonly degradedHealthTimeoutRate: number;
  private readonly severeHealthTimeoutRate: number;

  private readonly runtimeHealthSampler = getRuntimeHealthSampler();
  private readonly aiLimiter = getSharedAiInFlightLimiter();

  private timer: NodeJS.Timeout | null = null;
  private status: RuntimeLoadStatus = "healthy";
  private reason = "init";
  private consecutiveHealthyWindows = 0;

  constructor(params: {
    maxActiveTasks?: number;
    degradedMaxActiveTasks?: number;
    severeMaxActiveTasks?: number;
    healthyAiInFlight?: number;
    degradedAiInFlight?: number;
    severeAiInFlight?: number;
    checkIntervalMs?: number;
    windowMs?: number;
    degradedLagP95Ms?: number;
    severeLagP95Ms?: number;
    degradedTimeoutRate?: number;
    severeTimeoutRate?: number;
    degradedHealthTimeoutRate?: number;
    severeHealthTimeoutRate?: number;
  } = {}) {
    this.maxActiveTasks = params.maxActiveTasks ?? defaultMaxActiveTasks;
    this.degradedMaxActiveTasks = params.degradedMaxActiveTasks ?? defaultDegradedMaxActiveTasks;
    this.severeMaxActiveTasks = params.severeMaxActiveTasks ?? defaultSevereMaxActiveTasks;
    this.healthyAiInFlight = params.healthyAiInFlight ?? defaultHealthyAiInFlight;
    this.degradedAiInFlight = params.degradedAiInFlight ?? defaultDegradedAiInFlight;
    this.severeAiInFlight = params.severeAiInFlight ?? defaultSevereAiInFlight;
    this.checkIntervalMs = params.checkIntervalMs ?? defaultCheckIntervalMs;
    this.windowMs = params.windowMs ?? defaultWindowMs;
    this.degradedLagP95Ms = params.degradedLagP95Ms ?? defaultDegradedLagP95Ms;
    this.severeLagP95Ms = params.severeLagP95Ms ?? defaultSevereLagP95Ms;
    this.degradedTimeoutRate = params.degradedTimeoutRate ?? defaultDegradedTimeoutRate;
    this.severeTimeoutRate = params.severeTimeoutRate ?? defaultSevereTimeoutRate;
    this.degradedHealthTimeoutRate = params.degradedHealthTimeoutRate ?? defaultDegradedHealthTimeoutRate;
    this.severeHealthTimeoutRate = params.severeHealthTimeoutRate ?? defaultSevereHealthTimeoutRate;
  }

  start = () => {
    if (this.timer) return;
    this.runtimeHealthSampler.start();
    this.reconcile();
    this.timer = setInterval(this.reconcile, this.checkIntervalMs);
    this.timer.unref?.();
  };

  stop = () => {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  };

  getStatus = () => this.status;

  getState = (): GlobalLoadControllerState => ({
    status: this.status,
    updatedAt: new Date().toISOString(),
    reason: this.reason,
    stats: this.runtimeHealthSampler.getWindowStats(this.windowMs),
  });

  shouldPauseNewTasks = () => this.status === "severe";

  getActiveTaskLimit = () => {
    if (this.status === "severe") return this.severeMaxActiveTasks;
    if (this.status === "degraded") return this.degradedMaxActiveTasks;
    return this.maxActiveTasks;
  };

  private reconcile = () => {
    const stats = this.runtimeHealthSampler.getWindowStats(this.windowMs);
    const severeSignal = this.isSevere(stats);
    const degradedSignal = this.isDegraded(stats);

    if (severeSignal.hit) {
      this.status = "severe";
      this.reason = severeSignal.reason;
      this.consecutiveHealthyWindows = 0;
      this.aiLimiter.setGlobalLimit(this.severeAiInFlight);
      return;
    }

    if (degradedSignal.hit) {
      this.status = "degraded";
      this.reason = degradedSignal.reason;
      this.consecutiveHealthyWindows = 0;
      this.aiLimiter.setGlobalLimit(this.degradedAiInFlight);
      return;
    }

    this.consecutiveHealthyWindows += 1;
    if (this.consecutiveHealthyWindows >= 3) {
      this.status = "healthy";
      this.reason = "stable-window";
      this.aiLimiter.setGlobalLimit(this.healthyAiInFlight);
    }
  };

  private isDegraded = (stats: RuntimeWindowStats) => {
    if (stats.eventLoopLagP95Ms >= this.degradedLagP95Ms) {
      return { hit: true, reason: "event-loop-lag" };
    }
    if (stats.aiTimeoutRate >= this.degradedTimeoutRate) {
      return { hit: true, reason: "ai-timeout-rate" };
    }
    if (stats.healthTimeoutRate >= this.degradedHealthTimeoutRate) {
      return { hit: true, reason: "health-timeout-rate" };
    }
    return { hit: false, reason: "" };
  };

  private isSevere = (stats: RuntimeWindowStats) => {
    if (stats.eventLoopLagP95Ms >= this.severeLagP95Ms) {
      return { hit: true, reason: "event-loop-lag-severe" };
    }
    if (stats.aiTimeoutRate >= this.severeTimeoutRate) {
      return { hit: true, reason: "ai-timeout-rate-severe" };
    }
    if (stats.healthTimeoutRate >= this.severeHealthTimeoutRate) {
      return { hit: true, reason: "health-timeout-rate-severe" };
    }
    return { hit: false, reason: "" };
  };
}

let sharedGlobalLoadController: GlobalLoadController | null = null;

export const getSharedGlobalLoadController = () => {
  if (!sharedGlobalLoadController) {
    sharedGlobalLoadController = new GlobalLoadController();
  }

  return sharedGlobalLoadController;
};
