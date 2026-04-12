import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  reviewTaskSseEventSchemaByType,
  type ReviewTaskSseEventType,
} from "@shared/types/sse";
import { API_BASE_URL } from "@/lib/api";
import type { FindingListItem } from "@/lib/api-types";
import { queryKeys } from "./queries/queryKeys";

interface UseTaskEventStreamParams {
  taskId?: string;
  enabled?: boolean;
}

const findingBatchWindowMs = 100;

const parseJsonPayload = (event: MessageEvent<string>) => {
  try {
    return JSON.parse(event.data) as unknown;
  } catch {
    return null;
  }
};

export const useTaskEventStream = ({ taskId, enabled = true }: UseTaskEventStreamParams = {}) => {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const findingBufferRef = useRef<FindingListItem[]>([]);
  const findingFlushTimerRef = useRef<number | null>(null);

  const streamUrl = useMemo(() => {
    if (!taskId) return "";
    return `${API_BASE_URL}/review-tasks/${encodeURIComponent(taskId)}/events`;
  }, [taskId]);

  useEffect(() => {
    if (!enabled || !taskId || !streamUrl) return;

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

    const eventSource = new EventSource(streamUrl);

    const parseEvent = <T extends ReviewTaskSseEventType>(event: MessageEvent<string>, type: T) => {
      const rawPayload = parseJsonPayload(event);
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

    const onOpen = () => {
      setIsConnected(true);
    };

    const onError = () => {
      setIsConnected(false);
    };

    const onSnapshot = (event: MessageEvent<string>) => {
      const parsed = parseEvent(event, "snapshot");
      if (!parsed) return;

      queryClient.setQueryData(queryKeys.reviewTasks.detail(taskId), parsed.payload.task);
      queryClient.setQueryData(queryKeys.findings.list({ taskId }), parsed.payload.findings);
    };

    const onTaskUpdated = (event: MessageEvent<string>) => {
      const parsed = parseEvent(event, "task-updated");
      if (!parsed) return;

      queryClient.setQueryData(queryKeys.reviewTasks.detail(taskId), parsed.payload.task);
    };

    const onFindingCreated = (event: MessageEvent<string>) => {
      const parsed = parseEvent(event, "finding-created");
      if (!parsed) return;

      findingBufferRef.current.push(parsed.payload.finding);
      scheduleFindingFlush();
    };

    const onStreamError = (event: MessageEvent<string>) => {
      const parsed = parseEvent(event, "stream-error");
      if (!parsed) return;

      if (import.meta.env.DEV) {
        console.warn("SSE stream-error received", parsed.payload.message);
      }

      flushFindingBuffer();
      setIsConnected(false);
      eventSource.close();
      invalidateTaskAndFindings();
    };

    eventSource.addEventListener("open", onOpen);
    eventSource.addEventListener("error", onError);
    eventSource.addEventListener("snapshot", onSnapshot);
    eventSource.addEventListener("task-updated", onTaskUpdated);
    eventSource.addEventListener("finding-created", onFindingCreated);
    eventSource.addEventListener("stream-error", onStreamError);

    return () => {
      flushFindingBuffer();
      if (findingFlushTimerRef.current !== null) {
        window.clearTimeout(findingFlushTimerRef.current);
        findingFlushTimerRef.current = null;
      }
      setIsConnected(false);
      eventSource.removeEventListener("open", onOpen);
      eventSource.removeEventListener("error", onError);
      eventSource.removeEventListener("snapshot", onSnapshot);
      eventSource.removeEventListener("task-updated", onTaskUpdated);
      eventSource.removeEventListener("finding-created", onFindingCreated);
      eventSource.removeEventListener("stream-error", onStreamError);
      eventSource.close();
    };
  }, [enabled, queryClient, streamUrl, taskId]);

  return {
    isConnected,
  };
};
