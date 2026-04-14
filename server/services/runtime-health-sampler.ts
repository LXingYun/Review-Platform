import { monitorEventLoopDelay } from "node:perf_hooks";
import { parseDurationMs, parseNumber } from "./ai-config-service";

interface RuntimeSample {
  timestamp: number;
  rssBytes: number;
  privateBytes: number;
  eventLoopLagP95Ms: number;
  activeTasks: number;
  queuedTasks: number;
  aiInFlight: number;
}

interface AiRequestEvent {
  timestamp: number;
  success: boolean;
  rateLimited: boolean;
  timedOut: boolean;
}

interface HealthCheckEvent {
  timestamp: number;
  latencyMs: number;
  timedOut: boolean;
  ok: boolean;
}

export interface RuntimeSnapshot {
  sampledAt: string;
  rssBytes: number;
  privateBytes: number;
  eventLoopLagP95Ms: number;
  activeTasks: number;
  queuedTasks: number;
  aiInFlight: number;
}

export interface RuntimeWindowStats {
  windowMs: number;
  sampledAt: string;
  eventLoopLagP95Ms: number;
  latestRssBytes: number;
  latestPrivateBytes: number;
  maxRssBytes: number;
  maxPrivateBytes: number;
  activeTasks: number;
  queuedTasks: number;
  aiInFlight: number;
  aiInFlightPeak: number;
  aiRequestTotal: number;
  aiErrorRate: number;
  aiTimeoutRate: number;
  aiRateLimitRate: number;
  healthCheckTotal: number;
  healthTimeoutRate: number;
  healthLatencyP95Ms: number;
}

const defaultSampleIntervalMs = parseDurationMs({
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

const toPercentile = (values: number[], p: number) => {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  const sorted = values.slice().sort((left, right) => left - right);
  const rank = (sorted.length - 1) * p;
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);
  if (lowerIndex === upperIndex) return sorted[lowerIndex];

  const weight = rank - lowerIndex;
  return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
};

export class RuntimeHealthSampler {
  private readonly sampleIntervalMs: number;
  private readonly defaultWindowMs: number;
  private readonly eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });

  private started = false;
  private timer: NodeJS.Timeout | null = null;

  private activeTasks = 0;
  private queuedTasks = 0;
  private aiInFlight = 0;

  private samples: RuntimeSample[] = [];
  private aiEvents: AiRequestEvent[] = [];
  private healthChecks: HealthCheckEvent[] = [];

  constructor(params: {
    sampleIntervalMs?: number;
    defaultWindowMs?: number;
  } = {}) {
    this.sampleIntervalMs = Math.max(250, params.sampleIntervalMs ?? defaultSampleIntervalMs);
    this.defaultWindowMs = Math.max(60_000, params.defaultWindowMs ?? defaultWindowMs);
  }

  start = () => {
    if (this.started) return;
    this.started = true;
    this.eventLoopMonitor.enable();
    this.captureSample();
    this.timer = setInterval(() => {
      this.captureSample();
    }, this.sampleIntervalMs);
    this.timer.unref?.();
  };

  stop = () => {
    this.started = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.eventLoopMonitor.disable();
  };

  setQueueState = (params: {
    activeTasks: number;
    queuedTasks: number;
  }) => {
    this.activeTasks = Math.max(0, Math.floor(params.activeTasks));
    this.queuedTasks = Math.max(0, Math.floor(params.queuedTasks));
  };

  setAiInFlight = (value: number) => {
    this.aiInFlight = Math.max(0, Math.floor(value));
  };

  recordAiRequestResult = (params: {
    success: boolean;
    rateLimited?: boolean;
    timedOut?: boolean;
  }) => {
    this.aiEvents.push({
      timestamp: Date.now(),
      success: params.success,
      rateLimited: params.rateLimited === true,
      timedOut: params.timedOut === true,
    });
    this.trimEvents();
  };

  recordHealthCheck = (params: {
    latencyMs: number;
    timedOut?: boolean;
    ok?: boolean;
  }) => {
    this.healthChecks.push({
      timestamp: Date.now(),
      latencyMs: Number.isFinite(params.latencyMs) ? Math.max(0, params.latencyMs) : 0,
      timedOut: params.timedOut === true,
      ok: params.ok !== false,
    });
    this.trimEvents();
  };

  getLatestSnapshot = (): RuntimeSnapshot => {
    const latest = this.samples[this.samples.length - 1];
    if (!latest) {
      this.captureSample();
      return this.getLatestSnapshot();
    }

    return {
      sampledAt: new Date(latest.timestamp).toISOString(),
      rssBytes: latest.rssBytes,
      privateBytes: latest.privateBytes,
      eventLoopLagP95Ms: latest.eventLoopLagP95Ms,
      activeTasks: latest.activeTasks,
      queuedTasks: latest.queuedTasks,
      aiInFlight: latest.aiInFlight,
    };
  };

  getResourceMetrics = () => {
    const latest = this.getLatestSnapshot();
    return {
      rssBytes: latest.rssBytes,
      eventLoopLagMs: latest.eventLoopLagP95Ms,
    };
  };

  getWindowStats = (windowMs?: number): RuntimeWindowStats => {
    const effectiveWindowMs = Math.max(60_000, windowMs ?? this.defaultWindowMs);
    const now = Date.now();
    const cutoff = now - effectiveWindowMs;

    const windowSamples = this.samples.filter((item) => item.timestamp >= cutoff);
    const windowAiEvents = this.aiEvents.filter((item) => item.timestamp >= cutoff);
    const windowHealthChecks = this.healthChecks.filter((item) => item.timestamp >= cutoff);

    const latest = windowSamples[windowSamples.length - 1] ?? this.samples[this.samples.length - 1];

    const lagValues = windowSamples.map((item) => item.eventLoopLagP95Ms);
    const rssValues = windowSamples.map((item) => item.rssBytes);
    const privateValues = windowSamples.map((item) => item.privateBytes);
    const aiInFlightValues = windowSamples.map((item) => item.aiInFlight);

    const aiTotal = windowAiEvents.length;
    const aiTimeoutCount = windowAiEvents.filter((item) => item.timedOut).length;
    const aiRateLimitedCount = windowAiEvents.filter((item) => item.rateLimited).length;
    const aiErrorCount = windowAiEvents.filter((item) => !item.success).length;

    const healthTotal = windowHealthChecks.length;
    const healthTimeoutCount = windowHealthChecks.filter((item) => item.timedOut).length;

    return {
      windowMs: effectiveWindowMs,
      sampledAt: new Date(now).toISOString(),
      eventLoopLagP95Ms: toPercentile(lagValues, 0.95),
      latestRssBytes: latest?.rssBytes ?? 0,
      latestPrivateBytes: latest?.privateBytes ?? 0,
      maxRssBytes: rssValues.length ? Math.max(...rssValues) : 0,
      maxPrivateBytes: privateValues.length ? Math.max(...privateValues) : 0,
      activeTasks: latest?.activeTasks ?? this.activeTasks,
      queuedTasks: latest?.queuedTasks ?? this.queuedTasks,
      aiInFlight: latest?.aiInFlight ?? this.aiInFlight,
      aiInFlightPeak: aiInFlightValues.length ? Math.max(...aiInFlightValues) : this.aiInFlight,
      aiRequestTotal: aiTotal,
      aiErrorRate: aiTotal > 0 ? aiErrorCount / aiTotal : 0,
      aiTimeoutRate: aiTotal > 0 ? aiTimeoutCount / aiTotal : 0,
      aiRateLimitRate: aiTotal > 0 ? aiRateLimitedCount / aiTotal : 0,
      healthCheckTotal: healthTotal,
      healthTimeoutRate: healthTotal > 0 ? healthTimeoutCount / healthTotal : 0,
      healthLatencyP95Ms: toPercentile(windowHealthChecks.map((item) => item.latencyMs), 0.95),
    };
  };

  private captureSample = () => {
    const memory = process.memoryUsage();
    const lagP95Ns = this.eventLoopMonitor.percentile(95);
    this.eventLoopMonitor.reset();

    const sample: RuntimeSample = {
      timestamp: Date.now(),
      rssBytes: memory.rss,
      privateBytes: memory.heapUsed + memory.external + memory.arrayBuffers,
      eventLoopLagP95Ms: Number.isFinite(lagP95Ns) ? lagP95Ns / 1_000_000 : 0,
      activeTasks: this.activeTasks,
      queuedTasks: this.queuedTasks,
      aiInFlight: this.aiInFlight,
    };

    this.samples.push(sample);
    this.trimEvents();
  };

  private trimEvents = () => {
    const cutoff = Date.now() - Math.max(this.defaultWindowMs * 2, 2 * 60_000);
    this.samples = this.samples.filter((item) => item.timestamp >= cutoff);
    this.aiEvents = this.aiEvents.filter((item) => item.timestamp >= cutoff);
    this.healthChecks = this.healthChecks.filter((item) => item.timestamp >= cutoff);
  };
}

let sharedRuntimeHealthSampler: RuntimeHealthSampler | null = null;

export const getRuntimeHealthSampler = () => {
  if (!sharedRuntimeHealthSampler) {
    sharedRuntimeHealthSampler = new RuntimeHealthSampler();
  }

  return sharedRuntimeHealthSampler;
};

export const parseRateThreshold = (params: {
  value: string | undefined;
  fallback: number;
  min?: number;
  max?: number;
}) =>
  parseNumber({
    value: params.value,
    fallback: params.fallback,
    min: params.min ?? 0,
    max: params.max ?? 1,
  });
