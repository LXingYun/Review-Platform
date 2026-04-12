import { ApiRequestError } from "@/lib/api";

export const shouldRetryQuery = (failureCount: number, error: unknown) => {
  if (error instanceof ApiRequestError) {
    if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
      return false;
    }

    return failureCount < 2;
  }

  return failureCount < 2;
};

export const queryRetryDelay = (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 5000);
