import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("auth-service", () => {
  const originalCwd = process.cwd();
  const originalBootstrapUsername = process.env.AUTH_BOOTSTRAP_ADMIN_USERNAME;
  const originalBootstrapPassword = process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD;
  const originalSessionTtlDays = process.env.AUTH_SESSION_TTL_DAYS;
  const originalAuthDbPath = process.env.AUTH_DB_PATH;
  let tempDir = "";

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "auth-service-test-"));
    process.chdir(tempDir);
    process.env.AUTH_BOOTSTRAP_ADMIN_USERNAME = "admin";
    process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD = "AdminPassword123!";
    process.env.AUTH_SESSION_TTL_DAYS = "7";
    delete process.env.AUTH_DB_PATH;
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.chdir(originalCwd);

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore transient sqlite handle cleanup on Windows.
    }

    if (originalBootstrapUsername === undefined) {
      delete process.env.AUTH_BOOTSTRAP_ADMIN_USERNAME;
    } else {
      process.env.AUTH_BOOTSTRAP_ADMIN_USERNAME = originalBootstrapUsername;
    }

    if (originalBootstrapPassword === undefined) {
      delete process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD;
    } else {
      process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD = originalBootstrapPassword;
    }

    if (originalSessionTtlDays === undefined) {
      delete process.env.AUTH_SESSION_TTL_DAYS;
    } else {
      process.env.AUTH_SESSION_TTL_DAYS = originalSessionTtlDays;
    }

    if (originalAuthDbPath === undefined) {
      delete process.env.AUTH_DB_PATH;
    } else {
      process.env.AUTH_DB_PATH = originalAuthDbPath;
    }
  });

  it("bootstraps admin user and returns actor from token", async () => {
    const { initializeAuth, login, resolveActorByToken, getMe } = await import(
      "../../server/services/auth-service"
    );

    initializeAuth();
    const loginResult = login({
      username: "admin",
      password: "AdminPassword123!",
    });

    expect(loginResult.user.username).toBe("admin");
    expect(loginResult.user.role).toBe("admin");

    const actor = resolveActorByToken(loginResult.token);
    const me = getMe(actor);
    expect(me.user.id).toBe(actor.id);
    expect(me.user.username).toBe("admin");
  });

  it("prevents disabling the last active admin", async () => {
    const { initializeAuth, listManagedUsers, updateManagedUser } = await import(
      "../../server/services/auth-service"
    );

    initializeAuth();
    const [adminUser] = listManagedUsers();
    expect(adminUser).toBeTruthy();

    expect(() =>
      updateManagedUser({
        userId: adminUser.id,
        isActive: false,
      }),
    ).toThrowError(/至少保留一个启用状态的管理员账号/);
  });

  it("revokes other sessions after password change", async () => {
    const { login, resolveActorByToken, changePassword } = await import("../../server/services/auth-service");

    const first = login({ username: "admin", password: "AdminPassword123!" });
    const second = login({ username: "admin", password: "AdminPassword123!" });
    const actor = resolveActorByToken(first.token);

    changePassword({
      actor,
      currentSessionToken: first.token,
      oldPassword: "AdminPassword123!",
      newPassword: "UpdatedPassword123!",
    });

    expect(() => resolveActorByToken(second.token)).toThrowError(/session expired|unauthorized/i);

    const third = login({ username: "admin", password: "UpdatedPassword123!" });
    expect(third.user.username).toBe("admin");
  });
});
