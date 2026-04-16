import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { AuthLoginResponse, AuthMeResponse, AuthUserInfo } from "@/lib/api-types";
import { apiRequest } from "@/lib/api";
import { authUnauthorizedEvent, clearAuthToken, getAuthToken, setAuthToken } from "@/lib/auth";

interface AuthContextValue {
  user: AuthUserInfo | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (params: { username: string; password: string }) => Promise<AuthUserInfo>;
  logout: () => Promise<void>;
  changePassword: (params: { oldPassword: string; newPassword: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const value = useProvideAuth();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
};
