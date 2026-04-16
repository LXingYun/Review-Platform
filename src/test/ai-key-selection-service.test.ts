import { describe, expect, it } from "vitest";
import { resolveUnitKey, selectKeyIndex } from "../../server/services/ai-key-selection-service";

describe("ai-key-selection-service", () => {
  it("returns a stable index for the same fingerprint and review unit", () => {
    const first = selectKeyIndex({
      fingerprint: "fingerprint-1",
      reviewUnitId: "chapter:intro:1-3:3",
      keyCount: 4,
    });
    const second = selectKeyIndex({
      fingerprint: "fingerprint-1",
      reviewUnitId: "chapter:intro:1-3:3",
      keyCount: 4,
    });

    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(4);
  });

  it("maps to a concrete key without mutating the key pool", () => {
    const resolved = resolveUnitKey({
      apiKeys: ["k1", "k2", "k3"],
      fingerprint: "fingerprint-2",
      reviewUnitId: "cross:intro|pricing",
    });

    expect(["k1", "k2", "k3"]).toContain(resolved.apiKey);
    expect(resolved.keyId).toMatch(/^fixed-key-/);
    expect(resolved.index).toBeGreaterThanOrEqual(0);
    expect(resolved.index).toBeLessThan(3);
  });
});
