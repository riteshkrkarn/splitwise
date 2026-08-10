import { describe, expect, it } from "vitest";
import { computeNetBalances, simplifyDebts } from "@/lib/balances";
import { computeSplits } from "@/lib/split-validator";

describe("computeSplits", () => {
  it("splits equally with remainder on first", () => {
    const splits = computeSplits(100, "EQUAL", [
      { userId: "a" },
      { userId: "b" },
      { userId: "c" },
    ]);
    const sum = splits.reduce((s, x) => s + x.amount, 0);
    expect(sum).toBe(100);
    expect(splits).toHaveLength(3);
  });

  it("validates exact totals", () => {
    expect(() =>
      computeSplits(50, "EXACT", [
        { userId: "a", amount: 20 },
        { userId: "b", amount: 20 },
      ])
    ).toThrow();
  });
});

describe("simplifyDebts", () => {
  it("reduces A->B and B->C into A->C", () => {
    const net = computeNetBalances(
      [
        {
          currency: "INR",
          payers: [{ userId: "b", amount: 20 }],
          splits: [
            { userId: "a", amount: 20 },
            { userId: "b", amount: 0 },
          ],
        },
        {
          currency: "INR",
          payers: [{ userId: "c", amount: 20 }],
          splits: [
            { userId: "b", amount: 20 },
            { userId: "c", amount: 0 },
          ],
        },
      ],
      []
    );
    const inr = net.get("INR")!;
    const debts = simplifyDebts(inr, "INR");
    expect(debts.length).toBe(1);
    expect(debts[0].fromUserId).toBe("a");
    expect(debts[0].toUserId).toBe("c");
    expect(debts[0].amount).toBe(20);
  });
});
