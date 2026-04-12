import { describe, expect, it } from "vitest";
import { createAiKeyPool, getSharedAiKeyPool } from "../../server/services/ai-key-pool-service";

describe("ai-key-pool-service", () => {
  it("rotates keys and skips cooled-down keys", () => {
    let current = 0;
    const pool = createAiKeyPool({
      apiKeys: ["key-a", "key-b"],
      now: () => current,
    });

    const first = pool.acquire();
    const second = pool.acquire();
    expect(first.keyId).toBe("key-1");
    expect(second.keyId).toBe("key-2");

    pool.reportRateLimited({
      keyId: "key-1",
      cooldownMs: 1000,
    });

    current = 100;
    const duringCooldown = pool.acquire();
    expect(duringCooldown.keyId).toBe("key-2");

    current = 1500;
    const afterCooldown = pool.acquire();
    expect(afterCooldown.keyId).toBe("key-1");
  });

  it("reuses shared pool for the same key signature", () => {
    const first = getSharedAiKeyPool({
      apiKeys: ["same-a", "same-b"],
    });
    const second = getSharedAiKeyPool({
      apiKeys: ["same-a", "same-b"],
    });
    const third = getSharedAiKeyPool({
      apiKeys: ["same-a", "same-b", "same-c"],
    });

    expect(first).toBe(second);
    expect(third).not.toBe(first);
  });
});

