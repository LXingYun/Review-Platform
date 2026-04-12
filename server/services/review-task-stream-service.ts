import type express from "express";
import {
  type ReviewTaskSseEventType,
  reviewTaskSseEventSchemaByType,
} from "../../shared/types/sse";
import { listFindings } from "./finding-service";
import { getTask } from "./review-service";

const defaultPollIntervalMs = 1000;
const defaultHeartbeatIntervalMs = 15000;

const parseInterval = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const pollIntervalMs = parseInterval(process.env.TASK_SSE_POLL_INTERVAL_MS, defaultPollIntervalMs);
const heartbeatIntervalMs = parseInterval(process.env.TASK_SSE_HEARTBEAT_MS, defaultHeartbeatIntervalMs);

const isDevelopment = process.env.NODE_ENV !== "production";

const writeRawEvent = (res: express.Response, event: string, data: unknown) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const buildTaskSignature = (task: ReturnType<typeof getTask>) =>
  JSON.stringify({
    status: task.status,
    stage: task.stage,
    stageLabel: task.stageLabel,
    progress: task.progress,
    riskLevel: task.riskLevel,
    completedAt: task.completedAt,
    attemptCount: task.attemptCount,
  });

export const streamReviewTaskEvents = (params: {
  req: express.Request;
  res: express.Response;
  taskId: string;
}) => {
  const { req, res, taskId } = params;

  let closed = false;
  let lastTaskSignature = "";
  const seenFindingIds = new Set<string>();
  let seq = 0;

  const cleanup = (pollTimer?: NodeJS.Timeout, heartbeatTimer?: NodeJS.Timeout) => {
    if (closed) return;
    closed = true;
    if (pollTimer) clearInterval(pollTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  };

  const emitEvent = <T extends ReviewTaskSseEventType>(
    type: T,
    payload: (typeof reviewTaskSseEventSchemaByType)[T]["shape"]["payload"]["_output"],
  ) => {
    const envelope = {
      version: 1 as const,
      stream: "review-task" as const,
      type,
      taskId,
      seq: ++seq,
      emittedAt: new Date().toISOString(),
      payload,
    };

    const parsed = reviewTaskSseEventSchemaByType[type].safeParse(envelope);
    if (!parsed.success) {
      const reason = parsed.error.issues.map((issue) => issue.message).join("; ");
      throw new Error(`SSE payload schema validation failed (${type}): ${reason}`);
    }

    writeRawEvent(res, type, parsed.data);
  };

  const emitStreamError = (message: string) => {
    try {
      emitEvent("stream-error", { message });
    } catch {
      // no-op: if even stream-error fails validation, close the stream directly
    }
  };

  const sendSnapshot = () => {
    const task = getTask(taskId);
    const findings = listFindings({ taskId });
    lastTaskSignature = buildTaskSignature(task);
    findings.forEach((finding) => seenFindingIds.add(finding.id));
    emitEvent("snapshot", { task, findings });
  };

  const sendDelta = () => {
    const task = getTask(taskId);
    const signature = buildTaskSignature(task);
    if (signature !== lastTaskSignature) {
      lastTaskSignature = signature;
      emitEvent("task-updated", { task });
    }

    const findings = listFindings({ taskId });
    findings.forEach((finding) => {
      if (seenFindingIds.has(finding.id)) return;
      seenFindingIds.add(finding.id);
      emitEvent("finding-created", { finding });
    });
  };

  let pollTimer: NodeJS.Timeout | undefined;
  let heartbeatTimer: NodeJS.Timeout | undefined;

  try {
    sendSnapshot();

    pollTimer = setInterval(() => {
      if (closed) return;

      try {
        sendDelta();
      } catch (error) {
        const message = error instanceof Error ? error.message : "任务流推送失败";
        emitStreamError(message);
        cleanup(pollTimer, heartbeatTimer);
        res.end();
      }
    }, pollIntervalMs);

    heartbeatTimer = setInterval(() => {
      if (closed) return;

      try {
        emitEvent("heartbeat", { at: new Date().toISOString() });
      } catch (error) {
        const message = error instanceof Error ? error.message : "任务流心跳推送失败";
        emitStreamError(message);
        cleanup(pollTimer, heartbeatTimer);
        res.end();
      }
    }, heartbeatIntervalMs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "任务不存在";
    emitStreamError(message);
    cleanup(pollTimer, heartbeatTimer);
    res.end();

    if (isDevelopment) {
      throw error;
    }

    return;
  }

  req.on("close", () => {
    cleanup(pollTimer, heartbeatTimer);
  });
};
