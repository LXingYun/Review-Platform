export type UserRole = "admin" | "user";

export interface AuthActor {
  id: string;
  username: string;
  role: UserRole;
}

export interface AuthPublicUser extends AuthActor {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}
