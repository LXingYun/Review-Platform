import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import type { AuthLoginResponse, AuthMeResponse, AuthUserInfo } from "@/lib/api-types";
import { apiRequest } from "@/lib/api";
import { authUnauthorizedEvent, clearAuthToken, getAuthToken, setAuthToken } from "@/lib/auth";
import { AuthContext } from "./auth-context";
import type { AuthContextValue } from "./auth-context";

const useProvideAuth = (): AuthContextValue => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<AuthUserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    apiRequest<AuthMeResponse>("/auth/me")
      .then((payload) => {
        if (cancelled) return;
        setUser(payload.user);
      })
      .catch(() => {
        if (cancelled) return;
        clearAuthToken();
        setUser(null);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      clearAuthToken();
      setUser(null);

      if (location.pathname !== "/login") {
        const redirect = encodeURIComponent(location.pathname + location.search);
        navigate(`/login?redirect=${redirect}`, { replace: true });
      }
    };

    window.addEventListener(authUnauthorizedEvent, handler);
    return () => window.removeEventListener(authUnauthorizedEvent, handler);
  }, [location.pathname, location.search, navigate]);

  const login = async (params: { username: string; password: string }) => {
    const payload = await apiRequest<AuthLoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(params),
    });
    setAuthToken(payload.token);
    setUser(payload.user);
    return payload.user;
  };

  const logout = async () => {
    try {
      await apiRequest<void>("/auth/logout", { method: "POST" });
    } catch {
      // Best effort logout.
    } finally {
      clearAuthToken();
      setUser(null);
    }
  };

  const changePassword = async (params: { oldPassword: string; newPassword: string }) => {
    await apiRequest<void>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(params),
    });
  };

  return useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      changePassword,
    }),
    [isLoading, user],
  );
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const value = useProvideAuth();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
