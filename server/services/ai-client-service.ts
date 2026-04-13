import { getAiConfig } from "./ai-config-service";
import { getSharedAiKeyPool } from "./ai-key-pool-service";
import {
  type AiRetryEvent,
  createAiRequestError,
  isRateLimitedAiError,
  parseRetryAfterMs,
  withAiRetry,
} from "./ai-retry-service";

const stripUtf8Bom = (value: string) => value.replace(/^\uFEFF/, "");

const stripMarkdownCodeFence = (value: string) =>
  value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

const extractJsonEnvelope = (value: string) => {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return value;
  }

  return value.slice(start, end + 1);
};

const normalizeSmartQuoteDelimiters = (value: string) =>
  value
    .replace(/([{,]\s*)[\u201C\u201D\u300C\u300D\u300E\u300F\uFF02]([^\u201C\u201D\u300C\u300D\u300E\u300F\uFF02]+?)[\u201C\u201D\u300C\u300D\u300E\u300F\uFF02](\s*:)/g, '$1"$2"$3')
    .replace(/([:[,\s]\s*)[\u201C\u201D\u300C\u300D\u300E\u300F\uFF02]/g, '$1"')
    .replace(/[\u201C\u201D\u300C\u300D\u300E\u300F\uFF02](\s*[,}\]])/g, '"$1')
    .replace(/"\s*\uFF1A/g, '":');

const unique = <T>(values: T[]) => Array.from(new Set(values));

const resolveAiSamplingConfig = (seed?: number) => {
  const seedRaw = process.env.OPENAI_SEED;
  const parsedSeed = Number.isInteger(seed) ? seed : seedRaw ? Number(seedRaw) : NaN;

  return {
    temperature: 0,
    ...(Number.isInteger(parsedSeed) ? { seed: parsedSeed } : {}),
  };
};

const createRequestSignalWithTimeout = (params: {
  signal?: AbortSignal;
  timeoutMs: number;
}) => {
  if (params.timeoutMs <= 0) {
    return {
      signal: params.signal,
      didTimeout: () => false,
      dispose: () => {},
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const onAbort = (event: Event) => {
    const signal = event.target as AbortSignal;
    if (!controller.signal.aborted) {
      controller.abort(signal.reason);
    }
  };

  if (params.signal?.aborted) {
    controller.abort(params.signal.reason);
  } else {
    params.signal?.addEventListener("abort", onAbort, { once: true });
  }

  timer = setTimeout(() => {
    timedOut = true;
    if (!controller.signal.aborted) {
      controller.abort();
    }
  }, params.timeoutMs);

  const dispose = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    params.signal?.removeEventListener("abort", onAbort);
  };

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    dispose,
  };
};

export const parseStructuredJsonContent = <T>(content: string): T => {
  const cleaned = stripUtf8Bom(content).trim();
  const fenceStripped = stripMarkdownCodeFence(cleaned);
  const jsonEnvelope = extractJsonEnvelope(fenceStripped);
  const normalizedQuotes = normalizeSmartQuoteDelimiters(jsonEnvelope);
  const normalizedFence = normalizeSmartQuoteDelimiters(fenceStripped);

  const attempts = unique([cleaned, fenceStripped, jsonEnvelope, normalizedFence, normalizedQuotes]).filter(Boolean);

  let lastError: unknown = null;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI response cannot be parsed as JSON");
};

const requestChatCompletion = async (params: {
  apiKeys: string[];
  baseUrl: string;
  model: string;
  retryMaxAttempts: number;
  retryBaseDelayMs: number;
  keyCooldownMs: number;
  requestTimeoutMs: number;
  systemPrompt: string;
  userPrompt: string;
  seed?: number;
  signal?: AbortSignal;
  onRetry?: (event: AiRetryEvent) => void;
}) => {
  const sampling = resolveAiSamplingConfig(params.seed);
  const keyPool = getSharedAiKeyPool({
    apiKeys: params.apiKeys,
  });

  return withAiRetry({
    maxAttempts: params.retryMaxAttempts,
    baseDelayMs: params.retryBaseDelayMs,
    signal: params.signal,
    onRetry: params.onRetry,
    operation: async () => {
      const lease = keyPool.acquire();
      const requestSignal = createRequestSignalWithTimeout({
        signal: params.signal,
        timeoutMs: params.requestTimeoutMs,
      });

      try {
        const response = await fetch(`${params.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lease.apiKey}`,
          },
          body: JSON.stringify({
            model: params.model,
            ...sampling,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: params.systemPrompt },
              { role: "user", content: params.userPrompt },
            ],
          }),
          signal: requestSignal.signal,
        });

        if (!response.ok) {
          const payload = await response.text();
          throw createAiRequestError({
            message: `AI request failed: ${payload}`,
            statusCode: response.status,
            retryAfterMs: parseRetryAfterMs(response.headers.get("retry-after")),
          });
        }

        const payload = (await response.json()) as {
          choices?: Array<{
            message?: {
              content?: string;
            };
          }>;
        };

        const content = payload.choices?.[0]?.message?.content;
        if (!content) {
          throw createAiRequestError({
            message: "AI response content is empty",
            retryable: false,
          });
        }

        keyPool.reportSuccess({ keyId: lease.keyId });
        return content;
      } catch (error) {
        if (requestSignal.didTimeout()) {
          throw createAiRequestError({
            message: `AI request timed out after ${params.requestTimeoutMs}ms`,
            retryable: true,
          });
        }

        if (isRateLimitedAiError(error)) {
          keyPool.reportRateLimited({
            keyId: lease.keyId,
            cooldownMs: params.keyCooldownMs,
          });
        }
        throw error;
      } finally {
        requestSignal.dispose();
      }
    },
  });
};

const repairStructuredJson = async <T>(params: {
  apiKeys: string[];
  baseUrl: string;
  model: string;
  retryMaxAttempts: number;
  retryBaseDelayMs: number;
  keyCooldownMs: number;
  requestTimeoutMs: number;
  rawContent: string;
  seed?: number;
  signal?: AbortSignal;
  onRetry?: (event: AiRetryEvent) => void;
}) => {
  const repairedContent = await requestChatCompletion({
    apiKeys: params.apiKeys,
    baseUrl: params.baseUrl,
    model: params.model,
    retryMaxAttempts: params.retryMaxAttempts,
    retryBaseDelayMs: params.retryBaseDelayMs,
    keyCooldownMs: params.keyCooldownMs,
    requestTimeoutMs: params.requestTimeoutMs,
    systemPrompt: [
      "You are a JSON repair assistant.",
      "Repair the user input into valid JSON.",
      "Do not add explanations or change field semantics. Return JSON only.",
    ].join("\n"),
    userPrompt: params.rawContent,
    seed: params.seed,
    signal: params.signal,
    onRetry: params.onRetry,
  });

  return parseStructuredJsonContent<T>(repairedContent);
};

export const requestStructuredAiReview = async <T>(params: {
  systemPrompt: string;
  userPrompt: string;
  seed?: number;
  signal?: AbortSignal;
  onRetry?: (event: AiRetryEvent) => void;
}): Promise<T> => {
  const config = getAiConfig();

  if (!config.enabled || config.apiKeys.length === 0) {
    throw new Error("AI service is not configured: OPENAI_API_KEY");
  }

  const content = await requestChatCompletion({
    apiKeys: config.apiKeys,
    baseUrl: config.baseUrl,
    model: config.model,
    retryMaxAttempts: config.retryMaxAttempts,
    retryBaseDelayMs: config.retryBaseDelayMs,
    keyCooldownMs: config.keyCooldownMs,
    requestTimeoutMs: config.requestTimeoutMs,
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
    seed: params.seed,
    signal: params.signal,
    onRetry: params.onRetry,
  });

  try {
    return parseStructuredJsonContent<T>(content);
  } catch (parseError) {
    try {
      return await repairStructuredJson<T>({
        apiKeys: config.apiKeys,
        baseUrl: config.baseUrl,
        model: config.model,
        retryMaxAttempts: config.retryMaxAttempts,
        retryBaseDelayMs: config.retryBaseDelayMs,
        keyCooldownMs: config.keyCooldownMs,
        requestTimeoutMs: config.requestTimeoutMs,
        rawContent: content,
        seed: params.seed,
        signal: params.signal,
        onRetry: params.onRetry,
      });
    } catch {
      const snippet = stripUtf8Bom(content).replace(/\s+/g, " ").slice(0, 160);
      throw new Error(
        parseError instanceof Error ? `${parseError.message}: ${snippet}` : `AI response is not JSON: ${snippet}`,
      );
    }
  }
};
