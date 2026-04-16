import type { UserRole } from "../services/auth-types";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: UserRole;
      };
      authSessionToken?: string;
    }
  }
}

export {};
