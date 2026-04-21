import { createContext } from "react";
import type { AuthUserInfo } from "@/lib/api-types";

export interface AuthContextValue {
  user: AuthUserInfo | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (params: { username: string; password: string }) => Promise<AuthUserInfo>;
  logout: () => Promise<void>;
  changePassword: (params: { oldPassword: string; newPassword: string }) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
