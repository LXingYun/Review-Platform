import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/lib/api";
import { fetchSse } from "@/lib/fetch-sse";

describe("fetchSse", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("parses named SSE events with payload", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("event: snapshot\n"));
        controller.enqueue(encoder.encode('data: {"id":"task-1"}\n\n'));
        controller.enqueue(encoder.encode("event: heartbeat\n"));
        controller.enqueue(encoder.encode('data: {"at":"now"}\n\n'));
        controller.close();
      },
    });

    const fetchMock = vi.fn(async () =>
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const events: Array<{ event: string; data: string }> = [];
    await fetchSse({
      url: "http://localhost:8787/api/review-tasks/task-1/events",
      onEvent: (event) => events.push(event),
    });

    expect(events).toEqual([
      { event: "snapshot", data: '{"id":"task-1"}' },
      { event: "heartbeat", data: '{"at":"now"}' },
    ]);
  });

  it("throws ApiRequestError with status when response is not ok", async () => {
    const fetchMock = vi.fn(async () => new Response("Unauthorized", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchSse({
        url: "http://localhost:8787/api/review-tasks/task-1/events",
        onEvent: () => {},
      }),
    ).rejects.toEqual(expect.any(ApiRequestError));
  });
});
