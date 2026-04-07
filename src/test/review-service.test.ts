import { describe, expect, it } from "vitest";
import { resolveReviewExecutionMode } from "../../server/services/review-service";

describe("resolveReviewExecutionMode", () => {
  it("uses AI when AI is enabled", () => {
    expect(
      resolveReviewExecutionMode({
        aiEnabled: true,
      }),
    ).toBe("ai");
  });

  it("blocks review instead of falling back to local rules when AI is disabled", () => {
    expect(
      resolveReviewExecutionMode({
        aiEnabled: false,
      }),
    ).toBe("blocked");
  });
});
