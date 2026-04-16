import { createId, nowIso } from "../utils";
import { hashPassword, verifyPassword } from "./auth-password";
import {
  countActiveAdmins,
  countUsers,
  createSessionRecord,
  createUserRecord,
  getSessionWithUserByToken,
  getUserById,
  getUserByUsername,
  listUsers,
  normalizeUsername,
  revokeExpiredSessions,
  revokeOtherSessionsByUser,
  revokeSessionByToken,
  revokeSessionsByUser,
  runAuthTransaction,
  toPublicUser,
  updateUserLastLoginAt,
  updateUserPassword,
  updateUserRoleAndStatus,
} from "./auth-repository";
import type { AuthActor, AuthPublicUser, UserRole } from "./auth-types";
import { badRequest, forbidden, notFound, unauthorized } from "./http-error";
import { initializeAuthDatabase } from "./auth-db";

const defaultBootstrapAdminUsername = "admin";
const defaultSessionTtlDays = 7;
const usernamePattern = /^[a-zA-Z0-9._-]{3,32}$/;
const minPasswordLength = 10;
const maxPasswordLength = 128;

let authInitialized = false;

const parseSessionTtlDays = () => {
  const rawValue = Number(process.env.AUTH_SESSION_TTL_DAYS ?? defaultSessionTtlDays);
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return defaultSessionTtlDays;
  }

  return Math.floor(rawValue);
};

const resolveSessionExpiresAt = (createdAt: string) => {
  const createdAtMs = new Date(createdAt).getTime();
  const ttlMs = parseSessionTtlDays() * 24 * 60 * 60 * 1000;
  return new Date(createdAtMs + ttlMs).toISOString();
};

const assertValidUsername = (value: string) => {
  const normalized = normalizeUsername(value);
  if (!usernamePattern.test(normalized)) {
    throw badRequest("Username must be 3-32 chars: letters, numbers, dot, underscore, dash.");
  }

  return normalized;
};

const assertValidPassword = (value: string) => {
  if (value.length < minPasswordLength || value.length > maxPasswordLength) {
    throw badRequest(`Password length must be ${minPasswordLength}-${maxPasswordLength} characters.`);
  }
};

const assertRole = (value: string): UserRole => {
  if (value !== "admin" && value !== "user") {
    throw badRequest("Invalid role.");
  }

  return value;
};

const ensureBootstrapAdmin = () => {
  if (countUsers() > 0) {
    return;
  }

  const username = assertValidUsername(process.env.AUTH_BOOTSTRAP_ADMIN_USERNAME ?? defaultBootstrapAdminUsername);
  const password = process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD?.trim();

  if (!password) {
    throw new Error("AUTH_BOOTSTRAP_ADMIN_PASSWORD is required when no users exist.");
  }

  assertValidPassword(password);
  const now = nowIso();
  const hashed = hashPassword(password);

  createUserRecord({
    id: createId("user"),
    username,
    passwordSalt: hashed.salt,
    passwordHash: hashed.hash,
    role: "admin",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  });
};

export const initializeAuth = () => {
  if (authInitialized) {
    return;
  }

  initializeAuthDatabase();
  ensureBootstrapAdmin();
  authInitialized = true;
};

export interface LoginResult {
  token: string;
  expiresAt: string;
  user: AuthPublicUser;
}

export const login = (params: { username: string; password: string }): LoginResult => {
  initializeAuth();
  const normalizedUsername = assertValidUsername(params.username);
  const user = getUserByUsername(normalizedUsername);

  if (!user || !verifyPassword(params.password, user.passwordSalt, user.passwordHash)) {
    throw unauthorized("Invalid username or password.");
  }

  if (!user.isActive) {
    throw forbidden("Account is disabled.");
  }

  const createdAt = nowIso();
  const expiresAt = resolveSessionExpiresAt(createdAt);
  const session = createSessionRecord({
    userId: user.id,
    createdAt,
    expiresAt,
  });

  updateUserLastLoginAt(user.id, createdAt);
  const freshUser = getUserById(user.id);
  if (!freshUser) {
    throw unauthorized("Invalid session.");
  }

  return {
    token: session.token,
    expiresAt,
    user: toPublicUser(freshUser),
  };
};

export const resolveActorByToken = (token: string): AuthActor => {
  initializeAuth();
  revokeExpiredSessions(nowIso());

  const sessionWithUser = getSessionWithUserByToken(token);
  if (!sessionWithUser) {
    throw unauthorized("Unauthorized.");
  }

  const now = Date.now();
  const expiresAt = Date.parse(sessionWithUser.session.expiresAt);
  if (!Number.isFinite(expiresAt) || sessionWithUser.session.revokedAt || expiresAt <= now) {
    throw unauthorized("Session expired.");
  }

  if (!sessionWithUser.user.isActive) {
    throw forbidden("Account is disabled.");
  }

  return {
    id: sessionWithUser.user.id,
    username: sessionWithUser.user.username,
    role: sessionWithUser.user.role,
  };
};

export const getMe = (actor: AuthActor) => {
  initializeAuth();
  const user = getUserById(actor.id);
  if (!user || !user.isActive) {
    throw unauthorized("Unauthorized.");
  }

  return { user: toPublicUser(user) };
};

export const logout = (sessionToken: string) => {
  initializeAuth();
  revokeSessionByToken(sessionToken, nowIso());
};

export const changePassword = (params: {
  actor: AuthActor;
  currentSessionToken: string;
  oldPassword: string;
  newPassword: string;
}) => {
  initializeAuth();
  assertValidPassword(params.newPassword);

  const user = getUserById(params.actor.id);
  if (!user || !user.isActive) {
    throw unauthorized("Unauthorized.");
  }

  if (!verifyPassword(params.oldPassword, user.passwordSalt, user.passwordHash)) {
    throw unauthorized("Old password is incorrect.");
  }

  const hashed = hashPassword(params.newPassword);
  const timestamp = nowIso();

  runAuthTransaction(() => {
    updateUserPassword({
      userId: user.id,
      passwordSalt: hashed.salt,
      passwordHash: hashed.hash,
      updatedAt: timestamp,
    });
    revokeOtherSessionsByUser({
      userId: user.id,
      keepToken: params.currentSessionToken,
      revokedAt: timestamp,
    });
  });
};

export const listManagedUsers = () => {
  initializeAuth();
  return listUsers().map(toPublicUser);
};

export const createManagedUser = (params: {
  username: string;
  password: string;
  role: UserRole;
}) => {
  initializeAuth();
  const username = assertValidUsername(params.username);
  assertValidPassword(params.password);
  const role = assertRole(params.role);

  if (getUserByUsername(username)) {
    throw badRequest("Username already exists.");
  }

  const timestamp = nowIso();
  const hashed = hashPassword(params.password);
  const user = createUserRecord({
    id: createId("user"),
    username,
    passwordSalt: hashed.salt,
    passwordHash: hashed.hash,
    role,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastLoginAt: null,
  });

  if (!user) {
    throw badRequest("Failed to create user.");
  }

  return toPublicUser(user);
};

export const updateManagedUser = (params: {
  userId: string;
  role?: UserRole;
  isActive?: boolean;
}) => {
  initializeAuth();
  if (params.role === undefined && params.isActive === undefined) {
    throw badRequest("At least one field must be provided.");
  }

  const user = getUserById(params.userId);
  if (!user) {
    throw notFound("User not found.");
  }

  const nextRole = params.role ?? user.role;
  const nextIsActive = params.isActive ?? user.isActive;

  if (user.role === "admin" && user.isActive && (nextRole !== "admin" || !nextIsActive)) {
    if (countActiveAdmins() <= 1) {
      throw badRequest("至少保留一个启用状态的管理员账号。");
    }
  }

  const timestamp = nowIso();

  const updatedUser = runAuthTransaction(() => {
    const result = updateUserRoleAndStatus({
      userId: user.id,
      role: nextRole,
      isActive: nextIsActive,
      updatedAt: timestamp,
    });

    if (!nextIsActive) {
      revokeSessionsByUser(user.id, timestamp);
    }

    return result;
  });

  if (!updatedUser) {
    throw notFound("User not found.");
  }

  return toPublicUser(updatedUser);
};

export const resetManagedUserPassword = (params: { userId: string; password: string }) => {
  initializeAuth();
  assertValidPassword(params.password);

  const user = getUserById(params.userId);
  if (!user) {
    throw notFound("User not found.");
  }

  const timestamp = nowIso();
  const hashed = hashPassword(params.password);

  runAuthTransaction(() => {
    updateUserPassword({
      userId: user.id,
      passwordSalt: hashed.salt,
      passwordHash: hashed.hash,
      updatedAt: timestamp,
    });
    revokeSessionsByUser(user.id, timestamp);
  });
};
