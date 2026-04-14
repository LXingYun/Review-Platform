import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewTaskDispatcher } from "../../server/services/review-task-dispatcher";

describe("ReviewTaskDispatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not activate new tasks when global load controller pauses dispatch", async () => {
    const repository = {
      recoverInterruptedTasks: vi.fn(),
      countQueuedTasks: vi.fn(() => 1),
      claimNextQueuedTask: vi.fn(() => ({ taskId: "task-1", nextCursor: 0 })),
    };
    const runner = {
      runReviewTask: vi.fn(async () => {}),
    };
    const globalLoadController = {
      start: vi.fn(),
      shouldPauseNewTasks: vi.fn(() => true),
      getActiveTaskLimit: vi.fn(() => 1),
    };
    const runtimeHealthSampler = {
      start: vi.fn(),
      setQueueState: vi.fn(),
    };

    const dispatcher = new ReviewTaskDispatcher(
      repository as never,
      runner as never,
      globalLoadController as never,
      runtimeHealthSampler as never,
      2,
    );

    await (dispatcher as unknown as { drainQueue: () => Promise<void> }).drainQueue();

    expect(runner.runReviewTask).not.toHaveBeenCalled();
    expect(repository.claimNextQueuedTask).not.toHaveBeenCalled();
  });

  it("activates queued tasks and updates runtime queue state", async () => {
    const repository = {
      recoverInterruptedTasks: vi.fn(),
      countQueuedTasks: vi.fn(() => 1),
      claimNextQueuedTask: vi
        .fn()
        .mockReturnValueOnce({ taskId: "task-1", nextCursor: 1 })
        .mockReturnValueOnce({ taskId: null, nextCursor: 1 }),
    };
    const runner = {
      runReviewTask: vi.fn(async () => {}),
    };
    const globalLoadController = {
      start: vi.fn(),
      shouldPauseNewTasks: vi.fn(() => false),
      getActiveTaskLimit: vi.fn(() => 1),
    };
    const runtimeHealthSampler = {
      start: vi.fn(),
      setQueueState: vi.fn(),
    };

    const dispatcher = new ReviewTaskDispatcher(
      repository as never,
      runner as never,
      globalLoadController as never,
      runtimeHealthSampler as never,
      2,
    );

    await (dispatcher as unknown as { drainQueue: () => Promise<void> }).drainQueue();
    await Promise.resolve();

    expect(runner.runReviewTask).toHaveBeenCalledWith("task-1");
    expect(runtimeHealthSampler.setQueueState).toHaveBeenCalled();
  });
});
