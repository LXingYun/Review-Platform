import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const defaultDataDir = path.resolve(process.cwd(), "server-data");
const defaultAuthDatabaseFile = path.join(defaultDataDir, "auth.sqlite");

let authDatabase: DatabaseSync | null = null;

const resolveAuthDatabasePath = () => {
  const configuredPath = process.env.AUTH_DB_PATH?.trim();
  return configuredPath && configuredPath.length > 0 ? configuredPath : defaultAuthDatabaseFile;
};

const ensureAuthDataDir = (databasePath: string) => {
  if (databasePath === ":memory:") {
    return;
  }

  const directory = path.dirname(databasePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

const createAuthTables = (db: DatabaseSync) => {
  db.exec(
    [
      "CREATE TABLE IF NOT EXISTS auth_users (",
      "  id TEXT PRIMARY KEY,",
      "  username TEXT NOT NULL UNIQUE,",
      "  password_salt TEXT NOT NULL,",
      "  password_hash TEXT NOT NULL,",
      "  role TEXT NOT NULL,",
      "  is_active INTEGER NOT NULL,",
      "  created_at TEXT NOT NULL,",
      "  updated_at TEXT NOT NULL,",
      "  last_login_at TEXT",
      ");",
      "CREATE INDEX IF NOT EXISTS auth_users_role_idx ON auth_users(role);",
      "CREATE INDEX IF NOT EXISTS auth_users_is_active_idx ON auth_users(is_active);",
      "CREATE TABLE IF NOT EXISTS auth_sessions (",
      "  token_hash TEXT PRIMARY KEY,",
      "  user_id TEXT NOT NULL,",
      "  created_at TEXT NOT NULL,",
      "  expires_at TEXT NOT NULL,",
      "  revoked_at TEXT,",
      "  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE",
      ");",
      "CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id);",
      "CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions(expires_at);",
    ].join("\n"),
  );
};

const openAuthDatabase = () => {
  const databasePath = resolveAuthDatabasePath();
  ensureAuthDataDir(databasePath);

  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  createAuthTables(db);

  return db;
};

export const getAuthDatabase = () => {
  if (!authDatabase) {
    authDatabase = openAuthDatabase();
  }

  return authDatabase;
};

export const initializeAuthDatabase = () => {
  getAuthDatabase();
};
