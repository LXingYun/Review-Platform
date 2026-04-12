import { useCallback, useEffect, useMemo, useState } from "react";

const draftStoragePrefix = "review-platform-review-note-draft";
const maxDraftAgeMs = 7 * 24 * 60 * 60 * 1000;
const maxDraftCount = 50;
const defaultDebounceMs = 1000;

interface DraftRecord {
  value: string;
  updatedAt: number;
}

const isBrowser = () => typeof window !== "undefined";

const getDraftKey = (taskId: string, findingId: string) => `${draftStoragePrefix}:${taskId}:${findingId}`;

const parseDraftRecord = (raw: string | null): DraftRecord | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as DraftRecord;
    if (typeof parsed.value !== "string" || typeof parsed.updatedAt !== "number") {
      return null;
    }

    return parsed;
  } catch {
    return {
      value: raw,
      updatedAt: Date.now(),
    };
  }
};

const persistDraftRecord = (key: string, value: string) => {
  const payload: DraftRecord = {
    value,
    updatedAt: Date.now(),
  };

  window.localStorage.setItem(key, JSON.stringify(payload));
};

const runDraftGarbageCollection = () => {
  if (!isBrowser()) return;

  const now = Date.now();
  const records: Array<{ key: string; updatedAt: number }> = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(draftStoragePrefix)) continue;

    const record = parseDraftRecord(window.localStorage.getItem(key));
    if (!record) {
      window.localStorage.removeItem(key);
      continue;
    }

    if (now - record.updatedAt > maxDraftAgeMs) {
      window.localStorage.removeItem(key);
      continue;
    }

    records.push({ key, updatedAt: record.updatedAt });
  }

  if (records.length <= maxDraftCount) return;

  records
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(maxDraftCount)
    .forEach((record) => {
      window.localStorage.removeItem(record.key);
    });
};

export const useReviewNoteDraft = (params: {
  taskId: string;
  findingId?: string;
  debounceMs?: number;
}) => {
  const { taskId, findingId, debounceMs = defaultDebounceMs } = params;
  const [reviewNote, setReviewNote] = useState("");

  const draftKey = useMemo(() => {
    if (!taskId || !findingId) return "";
    return getDraftKey(taskId, findingId);
  }, [findingId, taskId]);

  const hasUnsavedDraft = Boolean(draftKey && reviewNote.trim());

  const clearDraft = useCallback(
    (targetFindingId?: string) => {
      if (!isBrowser()) return;

      const targetKey = targetFindingId ? getDraftKey(taskId, targetFindingId) : draftKey;
      if (!targetKey) return;
      window.localStorage.removeItem(targetKey);
    },
    [draftKey, taskId],
  );

  useEffect(() => {
    if (!isBrowser()) return;
    runDraftGarbageCollection();
  }, []);

  useEffect(() => {
    if (!isBrowser()) return;

    if (!draftKey) {
      setReviewNote("");
      return;
    }

    const record = parseDraftRecord(window.localStorage.getItem(draftKey));
    setReviewNote(record?.value ?? "");
  }, [draftKey]);

  useEffect(() => {
    if (!isBrowser() || !draftKey) return;

    const timer = window.setTimeout(() => {
      if (!reviewNote.trim()) {
        window.localStorage.removeItem(draftKey);
        return;
      }

      persistDraftRecord(draftKey, reviewNote);
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [debounceMs, draftKey, reviewNote]);

  useEffect(() => {
    if (!isBrowser() || !hasUnsavedDraft) return;

    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", beforeUnloadHandler);
    return () => {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
    };
  }, [hasUnsavedDraft]);

  return {
    reviewNote,
    setReviewNote,
    clearDraft,
    hasUnsavedDraft,
  };
};
