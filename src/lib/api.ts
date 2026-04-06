const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787/api";

interface RequestOptions extends RequestInit {
  body?: BodyInit | null;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "请求失败");
  }

  return response.json() as Promise<T>;
}

export { API_BASE_URL };
