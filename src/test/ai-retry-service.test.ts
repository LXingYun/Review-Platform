import { describe, expect, it } from "vitest";
import {
  createAiRequestError,
  parseRetryAfterMs,
  withAiRetry,
} from "../../server/services/ai-retry-service";

describe("ai-retry-service", () => {
  it("parses numeric retry-after values", () => {
    expect(parseRetryAfterMs("2")).toBe(2000);
  });

  it("retries for rate-limited errors and eventually succeeds", async () => {
    const retryEvents: number[] = [];
    const attempts: number[] = [];

    const result = await withAiRetry({
      maxAttempts: 3,
      baseDelayMs: 1,
      operation: async (attempt) => {
        attempts.push(attempt);
        if (attempt < 3) {
          throw createAiRequestError({
            message: "rate-limited",
            statusCode: 429,
          });
        }
        return "ok";
      },
      onRetry: (event) => {
        if (event.rateLimited) {
          retryEvents.push(event.attempt);
        }
      },
    });

    expect(result).toBe("ok");
    expect(attempts).toEqual([1, 2, 3]);
    expect(retryEvents).toEqual([1, 2]);
  });

  it("does not retry non-retryable request errors", async () => {
    let called = 0;

    await expect(
      withAiRetry({
        maxAttempts: 4,
        baseDelayMs: 1,
        operation: async () => {
          called += 1;
          throw createAiRequestError({
            message: "bad request",
            statusCode: 400,
          });
        },
      }),
    ).rejects.toThrow("bad request");

    expect(called).toBe(1);
  });
});

