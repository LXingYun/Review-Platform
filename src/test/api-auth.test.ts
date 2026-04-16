import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import { authUnauthorizedEvent, clearAuthToken, setAuthToken } from "@/lib/auth";

describe("api auth behavior", () => {
  afterEach(() => {
    clearAuthToken();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("injects Authorization header when token exists", async () => {
    setAuthToken("token-abc");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest<{ ok: boolean }>("/projects");

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(requestInit.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("does not inject Authorization header for login endpoint", async () => {
    setAuthToken("token-abc");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ token: "x" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "u", password: "p" }),
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(requestInit.headers);
    expect(headers.get("Authorization")).toBeNull();
  });

  it("emits unauthorized event on non-login 401 responses", async () => {
    const listener = vi.fn();
    window.addEventListener(authUnauthorizedEvent, listener);

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ message: "Unauthorized." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/projects")).rejects.toThrowError();
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(authUnauthorizedEvent, listener);
  });
});
