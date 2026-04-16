import { emitAuthUnauthorized, getAuthToken } from "./auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787/api";
const API_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_REQUEST_TIMEOUT_MS ?? 15000);

interface RequestOptions extends RequestInit {
  body?: BodyInit | null;
}

interface ApiRequestErrorOptions {
  status?: number;
  isTimeout?: boolean;
  isNetworkError?: boolean;
}

export class ApiRequestError extends Error {
  status?: number;
  isTimeout: boolean;
  isNetworkError: boolean;

  constructor(message: string, options: ApiRequestErrorOptions = {}) {
    super(message);
    this.name = "ApiRequestError";
    this.status = options.status;
    this.isTimeout = options.isTimeout ?? false;
    this.isNetworkError = options.isNetworkError ?? false;
  }
}

const shouldSkipAuthForPath = (path: string) => path.startsWith("/auth/login");

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  let response: Response;
  try {
    const headers = new Headers(options.headers ?? undefined);
    if (!(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    if (!shouldSkipAuthForPath(path)) {
      const token = getAuthToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiRequestError("Request timed out, please retry.", { isTimeout: true });
    }

    throw new ApiRequestError("Network unavailable, please retry.", { isNetworkError: true });
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!response.ok) {
    if (response.status === 401 && !shouldSkipAuthForPath(path)) {
      emitAuthUnauthorized();
    }

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiRequestError(payload?.message ?? "Request failed.", { status: response.status });
  }

  return response.json() as Promise<T>;
}

export { API_BASE_URL };
