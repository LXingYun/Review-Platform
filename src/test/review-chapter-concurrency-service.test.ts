import { describe, expect, it } from "vitest";
import { createAiRequestError } from "../../server/services/ai-retry-service";
import {
  createReviewChapterConcurrencyController,
  runWithAdaptiveChapterConcurrency,
} from "../../server/services/review-chapter-concurrency-service";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

describe("review-chapter-concurrency-service", () => {
  it("downgrades on repeated 429 and recovers after stable window", () => {
    let currentTime = 0;
    const metrics = { rssBytes: 0, eventLoopLagMs: 0 };

    const controller = createReviewChapterConcurrencyController({
      initialConcurrency: 3,
      minConcurrency: 2,
      now: () => currentTime,
      getRuntimeMetrics: () => metrics,
    });

    expect(controller.getCurrentConcurrency()).toBe(3);

    controller.recordFailure(
      createAiRequestError({
        message: "rate-limited",
        statusCode: 429,
      }),
    );
    expect(controller.getCurrentConcurrency()).toBe(3);

    controller.recordFailure(
      createAiRequestError({
        message: "rate-limited",
        statusCode: 429,
      }),
    );
    expect(controller.getCurrentConcurrency()).toBe(2);

    currentTime = 10 * 60 * 1000 + 1;
    controller.recordSuccess();
    expect(controller.getCurrentConcurrency()).toBe(3);
  });

  it("forces minimum concurrency under memory pressure", () => {
    const metrics = {
      rssBytes: 1_700 * 1024 * 1024,
      eventLoopLagMs: 0,
    };

    const controller = createReviewChapterConcurrencyController({
      initialConcurrency: 3,
      minConcurrency: 2,
      getRuntimeMetrics: () => metrics,
    });

    controller.recordSuccess();
    expect(controller.getCurrentConcurrency()).toBe(2);
  });

  it("respects concurrency limit and keeps output order stable", async () => {
    const controller = createReviewChapterConcurrencyController({
      initialConcurrency: 2,
      minConcurrency: 1,
      getRuntimeMetrics: () => ({
        rssBytes: 0,
        eventLoopLagMs: 0,
      }),
    });

    let active = 0;
    let maxActive = 0;

    const results = await runWithAdaptiveChapterConcurrency({
      items: [1, 2, 3, 4, 5],
      controller,
      worker: async ({ item }) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await sleep(10);
        active -= 1;
        return item * 10;
      },
    });

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it("aborts in-flight execution when signal is cancelled", async () => {
    const controller = createReviewChapterConcurrencyController({
      initialConcurrency: 2,
      minConcurrency: 1,
      getRuntimeMetrics: () => ({
        rssBytes: 0,
        eventLoopLagMs: 0,
      }),
    });

    const abortController = new AbortController();

    const runPromise = runWithAdaptiveChapterConcurrency({
      items: [1, 2, 3],
      controller,
      signal: abortController.signal,
      worker: async () => {
        await sleep(30);
        return 1;
      },
    });

    await sleep(5);
    abortController.abort();

    await expect(runPromise).rejects.toThrow("aborted");
  });

  it("returns the original worker error instead of abort when a chapter fails", async () => {
    const controller = createReviewChapterConcurrencyController({
      initialConcurrency: 2,
      minConcurrency: 1,
      getRuntimeMetrics: () => ({
        rssBytes: 0,
        eventLoopLagMs: 0,
      }),
    });

    const runPromise = runWithAdaptiveChapterConcurrency({
      items: [1, 2],
      controller,
      worker: async ({ item }) => {
        if (item === 1) {
          await sleep(5);
          throw new Error("chapter-1-failed");
        }

        await sleep(50);
        return item;
      },
    });

    await expect(runPromise).rejects.toThrow("chapter-1-failed");
  });
});
