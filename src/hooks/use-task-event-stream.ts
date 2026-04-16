import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { reviewTaskSseEventSchemaByType, type ReviewTaskSseEventType } from "@shared/types/sse";
import { API_BASE_URL, ApiRequestError } from "@/lib/api";
import { emitAuthUnauthorized, getAuthToken } from "@/lib/auth";
import { fetchSse } from "@/lib/fetch-sse";
import type { FindingListItem } from "@/lib/api-types";
import { queryKeys } from "./queries/queryKeys";

interface UseTaskEventStreamParams {
  taskId?: string;
  enabled?: boolean;
}

const findingBatchWindowMs = 100;
const reconnectBaseDelayMs = 1_000;
const reconnectMaxDelayMs = 15_000;

const parseJsonPayload = (rawData: string) => {
  try {
    return JSON.parse(rawData) as unknown;
  } catch {
    return null;
  }
};

export const useTaskEventStream = ({ taskId, enabled = true }: UseTaskEventStreamParams = {}) => {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const findingBufferRef = useRef<FindingListItem[]>([]);
  const findingFlushTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);

  const streamUrl = useMemo(() => {
    if (!taskId) return "";
    return `${API_BASE_URL}/review-tasks/${encodeURIComponent(taskId)}/events`;
  }, [taskId]);

  useEffect(() => {
    if (!enabled || !taskId || !streamUrl) return;

    let stopped = false;
    let abortController: AbortController | null = null;

    const flushFindingBuffer = () => {
      if (!taskId) return;

      const batch = findingBufferRef.current.splice(0);
      if (batch.length === 0) return;

      queryClient.setQueryData<FindingListItem[]>(queryKeys.findings.list({ taskId }), (current = []) => {
        const existingIds = new Set(current.map((item) => item.id));
        const mergedBatch = batch.filter((item) => !existingIds.has(item.id));
        if (mergedBatch.length === 0) return current;
        return [...mergedBatch, ...current];
      });
    };

    const scheduleFindingFlush = () => {
      if (findingFlushTimerRef.current !== null) return;
      findingFlushTimerRef.current = window.setTimeout(() => {
        findingFlushTimerRef.current = null;
        flushFindingBuffer();
      }, findingBatchWindowMs);
    };

    const invalidateTaskAndFindings = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewTasks.detail(taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.findings.list({ taskId }) });
    };

    const parseEvent = <T extends ReviewTaskSseEventType>(rawData: string, type: T) => {
      const rawPayload = parseJsonPayload(rawData);
      if (!rawPayload) return null;

      const parsed = reviewTaskSseEventSchemaByType[type].safeParse(rawPayload);
      if (!parsed.success) {
        if (import.meta.env.DEV) {
          console.warn(`Invalid SSE payload for ${type}`, parsed.error.issues);
        }
        return null;
      }

      if (parsed.data.taskId !== taskId) {
        return null;
      }

      return parsed.data;
    };

    const scheduleReconnect = () => {
      setIsConnected(false);
      if (stopped) return;
      if (reconnectTimerRef.current !== null) return;

      const delay = Math.min(
        reconnectMaxDelayMs,
        reconnectBaseDelayMs * 2 ** Math.max(0, reconnectAttemptRef.current),
      );
      reconnectAttemptRef.current += 1;

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        if (stopped) return;
        connect();
      }, delay);
    };

    const onSnapshot = (rawData: string) => {
      const parsed = parseEvent(rawData, "snapshot");
      if (!parsed) return;

      queryClient.setQueryData(queryKeys.reviewTasks.detail(taskId), parsed.payload.task);
      queryClient.setQueryData(queryKeys.findings.list({ taskId }), parsed.payload.findings);
    };

    const onTaskUpdated = (rawData: string) => {
      const parsed = parseEvent(rawData, "task-updated");
      if (!parsed) return;

      queryClient.setQueryData(queryKeys.reviewTasks.detail(taskId), parsed.payload.task);
    };

    const onFindingCreated = (rawData: string) => {
      const parsed = parseEvent(rawData, "finding-created");
      if (!parsed) return;

      findingBufferRef.current.push(parsed.payload.finding);
      scheduleFindingFlush();
    };

    const onStreamError = (rawData: string) => {
      const parsed = parseEvent(rawData, "stream-error");
      if (!parsed) return;

      if (import.meta.env.DEV) {
        console.warn("SSE stream-error received", parsed.payload.message);
      }

      flushFindingBuffer();
      invalidateTaskAndFindings();
      scheduleReconnect();
    };

    const handleStreamEvent = (event: { event: string; data: string }) => {
      if (event.event === "snapshot") {
        onSnapshot(event.data);
        return;
      }

      if (event.event === "task-updated") {
        onTaskUpdated(event.data);
        return;
      }

      if (event.event === "finding-created") {
        onFindingCreated(event.data);
        return;
      }

      if (event.event === "stream-error") {
        onStreamError(event.data);
      }
    };

    const connect = () => {
      abortController?.abort();
      abortController = new AbortController();
      const token = getAuthToken();

      void fetchSse({
        url: streamUrl,
        token,
        signal: abortController.signal,
        onOpen: () => {
          reconnectAttemptRef.current = 0;
          setIsConnected(true);
        },
        onEvent: handleStreamEvent,
      })
        .then(() => {
          if (stopped || abortController?.signal.aborted) return;
          flushFindingBuffer();
          scheduleReconnect();
        })
        .catch((error) => {
          if (stopped || abortController?.signal.aborted) return;

          if (error instanceof ApiRequestError && error.status === 401) {
            setIsConnected(false);
            emitAuthUnauthorized();
            return;
          }

          flushFindingBuffer();
          invalidateTaskAndFindings();
          scheduleReconnect();
        });
    };

    connect();

    return () => {
      stopped = true;
      abortController?.abort();
      flushFindingBuffer();
      if (findingFlushTimerRef.current !== null) {
        window.clearTimeout(findingFlushTimerRef.current);
        findingFlushTimerRef.current = null;
      }
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      reconnectAttemptRef.current = 0;
      setIsConnected(false);
    };
  }, [enabled, queryClient, streamUrl, taskId]);

  return {
    isConnected,
  };
};
