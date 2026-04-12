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
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...options.headers,
      },
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiRequestError("请求超时，请稍后重试", { isTimeout: true });
    }

    throw new ApiRequestError("网络连接异常，请稍后重试", { isNetworkError: true });
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiRequestError(payload?.message ?? "请求失败", { status: response.status });
  }

  return response.json() as Promise<T>;
}

export { API_BASE_URL };
