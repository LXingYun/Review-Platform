import { createHash, randomBytes } from "node:crypto";
import { getAuthDatabase } from "./auth-db";
import type { AuthPublicUser, UserRole } from "./auth-types";

export interface AuthUserRecord extends AuthPublicUser {
  passwordSalt: string;
  passwordHash: string;
}

export interface AuthSessionRecord {
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface AuthSessionWithUserRecord {
  session: AuthSessionRecord;
  user: AuthUserRecord;
}

interface AuthUserRow {
  id: string;
  username: string;
  password_salt: string;
  password_hash: string;
  role: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

interface AuthSessionRow {
  token_hash: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export const normalizeUsername = (value: string) => value.trim().toLowerCase();

const toUserRecord = (row: AuthUserRow): AuthUserRecord => ({
  id: row.id,
  username: row.username,
  passwordSalt: row.password_salt,
  passwordHash: row.password_hash,
  role: row.role as UserRole,
  isActive: row.is_active === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastLoginAt: row.last_login_at,
});

const toSessionRecord = (row: AuthSessionRow): AuthSessionRecord => ({
  tokenHash: row.token_hash,
  userId: row.user_id,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at,
});

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const generateToken = () => randomBytes(32).toString("base64url");

export const toPublicUser = (user: AuthUserRecord): AuthPublicUser => ({
  id: user.id,
  username: user.username,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  lastLoginAt: user.lastLoginAt,
});

export const runAuthTransaction = <T>(callback: () => T): T => {
  const db = getAuthDatabase();
  db.exec("BEGIN IMMEDIATE;");

  try {
    const result = callback();
    db.exec("COMMIT;");
    return result;
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
};

export const countUsers = () => {
  const db = getAuthDatabase();
  const row = db.prepare("SELECT COUNT(*) AS count FROM auth_users").get() as { count: number };
  return row.count;
};

export const countActiveAdmins = () => {
  const db = getAuthDatabase();
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM auth_users WHERE role = 'admin' AND is_active = 1")
    .get() as { count: number };
  return row.count;
};

export const getUserById = (userId: string) => {
  const db = getAuthDatabase();
  const row = db.prepare("SELECT * FROM auth_users WHERE id = ? LIMIT 1").get(userId) as AuthUserRow | undefined;
  return row ? toUserRecord(row) : null;
};

export const getUserByUsername = (username: string) => {
  const normalizedUsername = normalizeUsername(username);
  const db = getAuthDatabase();
  const row = db
    .prepare("SELECT * FROM auth_users WHERE username = ? LIMIT 1")
    .get(normalizedUsername) as AuthUserRow | undefined;
  return row ? toUserRecord(row) : null;
};

export const listUsers = () => {
  const db = getAuthDatabase();
  const rows = db
    .prepare("SELECT * FROM auth_users ORDER BY created_at DESC, username ASC")
    .all() as unknown as AuthUserRow[];
  return rows.map(toUserRecord);
};

export const createUserRecord = (params: {
  id: string;
  username: string;
  passwordSalt: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}) => {
  const db = getAuthDatabase();
  const normalizedUsername = normalizeUsername(params.username);
  db.prepare(
    [
      "INSERT INTO auth_users (",
      "  id, username, password_salt, password_hash, role, is_active, created_at, updated_at, last_login_at",
      ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ].join(" "),
  ).run(
    params.id,
    normalizedUsername,
    params.passwordSalt,
    params.passwordHash,
    params.role,
    params.isActive ? 1 : 0,
    params.createdAt,
    params.updatedAt,
    params.lastLoginAt ?? null,
  );

  return getUserById(params.id);
};

export const updateUserRoleAndStatus = (params: {
  userId: string;
  role: UserRole;
  isActive: boolean;
  updatedAt: string;
}) => {
  const db = getAuthDatabase();
  db.prepare("UPDATE auth_users SET role = ?, is_active = ?, updated_at = ? WHERE id = ?").run(
    params.role,
    params.isActive ? 1 : 0,
    params.updatedAt,
    params.userId,
  );
  return getUserById(params.userId);
};

export const updateUserPassword = (params: {
  userId: string;
  passwordSalt: string;
  passwordHash: string;
  updatedAt: string;
}) => {
  const db = getAuthDatabase();
  db.prepare("UPDATE auth_users SET password_salt = ?, password_hash = ?, updated_at = ? WHERE id = ?").run(
    params.passwordSalt,
    params.passwordHash,
    params.updatedAt,
    params.userId,
  );
  return getUserById(params.userId);
};

export const updateUserLastLoginAt = (userId: string, value: string) => {
  const db = getAuthDatabase();
  db.prepare("UPDATE auth_users SET last_login_at = ?, updated_at = ? WHERE id = ?").run(value, value, userId);
};

export const createSessionRecord = (params: {
  userId: string;
  createdAt: string;
  expiresAt: string;
}) => {
  const db = getAuthDatabase();
  const token = generateToken();
  const tokenHash = hashToken(token);

  db.prepare(
    "INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, NULL)",
  ).run(tokenHash, params.userId, params.createdAt, params.expiresAt);

  return { token, tokenHash, expiresAt: params.expiresAt };
};

export const getSessionByToken = (token: string) => {
  const db = getAuthDatabase();
  const tokenHash = hashToken(token);
  const row = db
    .prepare("SELECT * FROM auth_sessions WHERE token_hash = ? LIMIT 1")
    .get(tokenHash) as AuthSessionRow | undefined;
  return row ? toSessionRecord(row) : null;
};

export const getSessionWithUserByToken = (token: string) => {
  const db = getAuthDatabase();
  const tokenHash = hashToken(token);
  const row = db
    .prepare(
      [
        "SELECT",
        "  s.token_hash, s.user_id, s.created_at, s.expires_at, s.revoked_at,",
        "  u.id AS user_id_value, u.username, u.password_salt, u.password_hash, u.role,",
        "  u.is_active, u.created_at AS user_created_at, u.updated_at AS user_updated_at, u.last_login_at",
        "FROM auth_sessions s",
        "JOIN auth_users u ON u.id = s.user_id",
        "WHERE s.token_hash = ?",
        "LIMIT 1",
      ].join(" "),
    )
    .get(tokenHash) as
    | (AuthSessionRow & {
        user_id_value: string;
        username: string;
        password_salt: string;
        password_hash: string;
        role: string;
        is_active: number;
        user_created_at: string;
        user_updated_at: string;
        last_login_at: string | null;
      })
    | undefined;

  if (!row) {
    return null;
  }

  return {
    session: toSessionRecord(row),
    user: {
      id: row.user_id_value,
      username: row.username,
      passwordSalt: row.password_salt,
      passwordHash: row.password_hash,
      role: row.role as UserRole,
      isActive: row.is_active === 1,
      createdAt: row.user_created_at,
      updatedAt: row.user_updated_at,
      lastLoginAt: row.last_login_at,
    },
  } satisfies AuthSessionWithUserRecord;
};

export const revokeSessionByToken = (token: string, revokedAt: string) => {
  const db = getAuthDatabase();
  const tokenHash = hashToken(token);
  db.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").run(
    revokedAt,
    tokenHash,
  );
};

export const revokeSessionsByUser = (userId: string, revokedAt: string) => {
  const db = getAuthDatabase();
  db.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").run(
    revokedAt,
    userId,
  );
};

export const revokeOtherSessionsByUser = (params: {
  userId: string;
  keepToken: string;
  revokedAt: string;
}) => {
  const db = getAuthDatabase();
  const keepTokenHash = hashToken(params.keepToken);
  db.prepare(
    "UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND token_hash != ? AND revoked_at IS NULL",
  ).run(params.revokedAt, params.userId, keepTokenHash);
};

export const revokeExpiredSessions = (nowIsoValue: string) => {
  const db = getAuthDatabase();
  db.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE expires_at <= ? AND revoked_at IS NULL").run(
    nowIsoValue,
    nowIsoValue,
  );
};
