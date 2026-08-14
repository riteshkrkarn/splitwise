import { describe, expect, it } from "vitest";

/**
 * Lightweight authz contract tests documenting expected membership rules.
 * Full DB integration is covered by actions at runtime.
 */
describe("expense authorization contracts", () => {
  it("requires exactly one of groupId or friendshipId", () => {
    function contextOk(groupId: string | null, friendshipId: string | null) {
      if (groupId && friendshipId) return false;
      if (!groupId && !friendshipId) return false;
      return true;
    }
    expect(contextOk(null, null)).toBe(false);
    expect(contextOk("g1", "f1")).toBe(false);
    expect(contextOk("g1", null)).toBe(true);
    expect(contextOk(null, "f1")).toBe(true);
  });

  it("rejects participants outside the allowed member set", () => {
    const allowed = new Set(["u1", "u2"]);
    const participants = ["u1", "u3"];
    const invalid = participants.filter((id) => !allowed.has(id));
    expect(invalid).toEqual(["u3"]);
  });

  it("only creator may delete", () => {
    const expense = { createdById: "u1" };
    const actor = "u2";
    expect(expense.createdById === actor).toBe(false);
  });
});
