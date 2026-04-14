const splitAndTrim = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const parseNumber = (params: {
  value: string | undefined;
  fallback: number;
  min?: number;
  max?: number;
}) => {
  const parsed = Number(params.value);
  if (!Number.isFinite(parsed)) return params.fallback;

  let normalized = parsed;
  if (typeof params.min === "number") {
    normalized = Math.max(params.min, normalized);
  }
  if (typeof params.max === "number") {
    normalized = Math.min(params.max, normalized);
  }

  return normalized;
};

export const parseDurationMs = (params: {
  value: string | undefined;
  fallback: number;
  min?: number;
  max?: number;
}) =>
  Math.floor(
    parseNumber({
      value: params.value,
      fallback: params.fallback,
      min: params.min,
      max: params.max,
    }),
  );

const resolveApiKeys = () => {
  const keys = splitAndTrim(process.env.OPENAI_API_KEYS ?? "");
  if (keys.length > 0) {
    return keys;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  return apiKey ? [apiKey] : [];
};

export const getAiConfig = () => {
  const apiKeys = resolveApiKeys();
  const apiKey = apiKeys[0];
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const chapterReviewConcurrency = parseNumber({
    value: process.env.TENDER_CHAPTER_REVIEW_CONCURRENCY,
    fallback: 3,
    min: 1,
    max: 12,
  });

  const chapterReviewMinConcurrency = parseNumber({
    value: process.env.TENDER_CHAPTER_REVIEW_MIN_CONCURRENCY,
    fallback: 2,
    min: 1,
    max: chapterReviewConcurrency,
  });

  return {
    enabled: apiKeys.length > 0,
    apiKey,
    apiKeys,
    baseUrl,
    model,
    retryMaxAttempts: Math.floor(
      parseNumber({
        value: process.env.AI_RETRY_MAX_ATTEMPTS,
        fallback: 4,
        min: 1,
        max: 10,
      }),
    ),
    retryBaseDelayMs: parseDurationMs({
      value: process.env.AI_RETRY_BASE_DELAY_MS,
      fallback: 800,
      min: 100,
      max: 10_000,
    }),
    keyCooldownMs: parseDurationMs({
      value: process.env.AI_KEY_COOLDOWN_MS,
      fallback: 45_000,
      min: 1_000,
      max: 10 * 60_000,
    }),
    requestTimeoutMs: parseDurationMs({
      value: process.env.AI_REQUEST_TIMEOUT_MS,
      fallback: 90_000,
      min: 1_000,
      max: 10 * 60_000,
    }),
    chapterReviewConcurrency,
    chapterReviewMinConcurrency,
    reviewMinVisibleDurationMs: parseDurationMs({
      value: process.env.REVIEW_MIN_VISIBLE_DURATION_MS,
      fallback: 500,
      min: 0,
      max: 120_000,
    }),
  };
};

export const getReviewWorkerConcurrency = () =>
  Math.floor(
    parseNumber({
      value: process.env.REVIEW_WORKER_CONCURRENCY,
      fallback: 1,
      min: 1,
      max: 12,
    }),
  );
