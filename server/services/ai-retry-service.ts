const retryableStatusCodes = new Set([408, 429, 500, 502, 503, 504]);

interface AiErrorWithMetadata extends Error {
  statusCode?: number;
  retryAfterMs?: number;
  retryable?: boolean;
}

export interface AiRetryEvent {
  attempt: number;
  nextAttempt: number;
  delayMs: number;
  statusCode?: number;
  rateLimited: boolean;
}

const createAbortError = () => {
  const error = new Error("aborted");
  error.name = "AbortError";
  return error;
};

const waitWithSignal = (delayMs: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (delayMs <= 0) {
      resolve();
      return;
    }

    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, delayMs);

    const onAbort = () => {
      cleanup();
      reject(createAbortError());
    };

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });

export const parseRetryAfterMs = (value: string | null | undefined) => {
  if (!value) return null;

  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return Math.floor(asNumber * 1000);
  }

  const timestamp = Date.parse(value);
  if (Number.isFinite(timestamp)) {
    const delay = timestamp - Date.now();
    return delay > 0 ? delay : 0;
  }

  return null;
};

export const createAiRequestError = (params: {
  message: string;
  statusCode?: number;
  retryAfterMs?: number | null;
  retryable?: boolean;
}) => {
  const error = new Error(params.message) as AiErrorWithMetadata;
  error.statusCode = params.statusCode;
  error.retryAfterMs = params.retryAfterMs ?? undefined;
  error.retryable = params.retryable;
  return error;
};

export const isRateLimitedAiError = (error: unknown) =>
  error instanceof Error && (error as AiErrorWithMetadata).statusCode === 429;

const isAbortError = (error: unknown) =>
  error instanceof Error && (error.name === "AbortError" || error.message.includes("aborted"));

export const isRetryableAiError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  if (isAbortError(error)) return false;

  const typedError = error as AiErrorWithMetadata;

  if (typedError.retryable === true) return true;
  if (typedError.retryable === false) return false;

  if (typedError.statusCode && retryableStatusCodes.has(typedError.statusCode)) {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("socket hang up")
  );
};

const resolveRetryDelayMs = (params: {
  error: unknown;
  baseDelayMs: number;
  attempt: number;
}) => {
  const typedError = params.error as AiErrorWithMetadata;
  const retryAfterMs =
    typeof typedError?.retryAfterMs === "number" && Number.isFinite(typedError.retryAfterMs)
      ? Math.max(0, typedError.retryAfterMs)
      : null;

  if (retryAfterMs !== null) {
    return retryAfterMs;
  }

  const exponent = Math.max(0, params.attempt - 1);
  const rawBackoff = params.baseDelayMs * 2 ** exponent;
  const cappedBackoff = Math.min(rawBackoff, 12_000);
  const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(cappedBackoff * 0.2)));
  return cappedBackoff + jitter;
};

export const withAiRetry = async <T>(params: {
  operation: (attempt: number) => Promise<T>;
  maxAttempts: number;
  baseDelayMs: number;
  signal?: AbortSignal;
  onRetry?: (event: AiRetryEvent) => void;
}) => {
  const maxAttempts = Math.max(1, params.maxAttempts);
  const baseDelayMs = Math.max(0, params.baseDelayMs);

  let attempt = 1;
  while (attempt <= maxAttempts) {
    if (params.signal?.aborted) {
      throw createAbortError();
    }

    try {
      return await params.operation(attempt);
    } catch (error) {
      const shouldRetry = isRetryableAiError(error) && attempt < maxAttempts;
      if (!shouldRetry) {
        throw error;
      }

      const delayMs = resolveRetryDelayMs({
        error,
        baseDelayMs,
        attempt,
      });

      params.onRetry?.({
        attempt,
        nextAttempt: attempt + 1,
        delayMs,
        statusCode: (error as AiErrorWithMetadata).statusCode,
        rateLimited: isRateLimitedAiError(error),
      });

      await waitWithSignal(delayMs, params.signal);
      attempt += 1;
    }
  }

  throw createAiRequestError({
    message: "AI retry exhausted",
    retryable: false,
  });
};

