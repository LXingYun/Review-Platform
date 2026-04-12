import { describe, expect, it } from "vitest";
import { toDeterministicSeed } from "../../server/services/review-seed-service";

describe("toDeterministicSeed", () => {
  it("returns the same seed for the same project id", () => {
    const projectId = "project-seed-stability";

    expect(toDeterministicSeed(projectId)).toBe(toDeterministicSeed(projectId));
  });

  it("returns different seeds for different project ids", () => {
    expect(toDeterministicSeed("project-A")).not.toBe(toDeterministicSeed("project-B"));
  });

  it("normalizes empty and whitespace ids to the minimum seed", () => {
    expect(toDeterministicSeed("")).toBe(1);
    expect(toDeterministicSeed("   ")).toBe(1);
  });

  it("always returns a valid 32-bit signed positive seed range", () => {
    const seed = toDeterministicSeed("project-range-check");

    expect(seed).toBeGreaterThanOrEqual(1);
    expect(seed).toBeLessThanOrEqual(2_147_483_646);
  });
});

