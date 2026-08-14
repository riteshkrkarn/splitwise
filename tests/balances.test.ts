import { describe, expect, it } from "vitest";
import {
  computeNetBalances,
  computePairwiseDebts,
  simplifyDebts,
  summarizeBalances,
} from "@/lib/balances";
import { computeSplits, validatePayers } from "@/lib/split-validator";
import { safeNextPath, validatePassword } from "@/lib/security";
import { suggestSettlements } from "@/lib/debt-simplifier";

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

  it("splits by percentage with remainder on first", () => {
    const splits = computeSplits(100, "PERCENTAGE", [
      { userId: "a", percent: 33.33 },
      { userId: "b", percent: 33.33 },
      { userId: "c", percent: 33.34 },
    ]);
    expect(splits.reduce((s, x) => s + x.amount, 0)).toBe(100);
  });

  it("splits by shares", () => {
    const splits = computeSplits(90, "SHARES", [
      { userId: "a", shares: 1 },
      { userId: "b", shares: 2 },
    ]);
    expect(splits.find((s) => s.userId === "a")?.amount).toBe(30);
    expect(splits.find((s) => s.userId === "b")?.amount).toBe(60);
  });
});

describe("validatePayers", () => {
  it("requires payer total to match", () => {
    expect(() =>
      validatePayers(100, [
        { userId: "a", amount: 40 },
        { userId: "b", amount: 50 },
      ])
    ).toThrow();
    expect(() =>
      validatePayers(100, [
        { userId: "a", amount: 40 },
        { userId: "b", amount: 60 },
      ])
    ).not.toThrow();
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

describe("computePairwiseDebts", () => {
  it("keeps both sides when a user owes one person and is owed by another", () => {
    const pairwise = computePairwiseDebts(
      [
        {
          currency: "INR",
          payers: [{ userId: "mayank", amount: 100 }],
          splits: [
            { userId: "ritesh", amount: 50 },
            { userId: "mayank", amount: 50 },
          ],
        },
        {
          currency: "INR",
          payers: [{ userId: "ritesh", amount: 80 }],
          splits: [
            { userId: "shreshth", amount: 80 },
            { userId: "ritesh", amount: 0 },
          ],
        },
      ],
      []
    );
    const debts = pairwise.get("INR") ?? [];
    expect(debts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromUserId: "ritesh",
          toUserId: "mayank",
          amount: 50,
        }),
        expect.objectContaining({
          fromUserId: "shreshth",
          toUserId: "ritesh",
          amount: 80,
        }),
      ])
    );
  });
});

describe("summarizeBalances simplify flag", () => {
  it("uses simplified debts when simplify is true and pairwise when false", () => {
    const expenses = [
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
    ];
    const net = computeNetBalances(expenses, []);
    const pairwise = computePairwiseDebts(expenses, []);
    const simplified = summarizeBalances(net, true, pairwise);
    const direct = summarizeBalances(net, false, pairwise);

    expect(simplified[0].debts).toHaveLength(1);
    expect(simplified[0].debts[0]).toMatchObject({
      fromUserId: "a",
      toUserId: "c",
      amount: 20,
    });
    expect(direct[0].debts.length).toBeGreaterThan(1);
    expect(direct[0].debts).toEqual(pairwise.get("INR"));
  });

  it("keeps currencies separate and does not mix amounts", () => {
    const net = computeNetBalances(
      [
        {
          currency: "INR",
          payers: [{ userId: "a", amount: 100 }],
          splits: [
            { userId: "a", amount: 50 },
            { userId: "b", amount: 50 },
          ],
        },
        {
          currency: "USD",
          payers: [{ userId: "a", amount: 10 }],
          splits: [
            { userId: "a", amount: 5 },
            { userId: "b", amount: 5 },
          ],
        },
      ],
      []
    );
    const summaries = summarizeBalances(net, false, computePairwiseDebts(
      [
        {
          currency: "INR",
          payers: [{ userId: "a", amount: 100 }],
          splits: [
            { userId: "a", amount: 50 },
            { userId: "b", amount: 50 },
          ],
        },
        {
          currency: "USD",
          payers: [{ userId: "a", amount: 10 }],
          splits: [
            { userId: "a", amount: 5 },
            { userId: "b", amount: 5 },
          ],
        },
      ],
      []
    ));
    expect(summaries.map((s) => s.currency).sort()).toEqual(["INR", "USD"]);
    expect(summaries.find((s) => s.currency === "INR")?.netByUser.a).toBe(50);
    expect(summaries.find((s) => s.currency === "USD")?.netByUser.a).toBe(5);
  });
});

describe("settlement amount caps (logic)", () => {
  it("pairwise debt amount is the max payable", () => {
    const pairwise = computePairwiseDebts(
      [
        {
          currency: "INR",
          payers: [{ userId: "a", amount: 100 }],
          splits: [
            { userId: "a", amount: 40 },
            { userId: "b", amount: 60 },
          ],
        },
      ],
      []
    );
    const debt = (pairwise.get("INR") ?? []).find(
      (d) => d.fromUserId === "b" && d.toUserId === "a"
    );
    expect(debt?.amount).toBe(60);
    expect(70 > (debt?.amount ?? 0)).toBe(true);
  });
});

describe("safeNextPath", () => {
  it("rejects protocol-relative and encoded open redirects", () => {
    expect(safeNextPath("//evil.com")).toBe("/dashboard");
    expect(safeNextPath("/%2f%2fevil.com")).toBe("/dashboard");
    expect(safeNextPath("https://evil.com")).toBe("/dashboard");
    expect(safeNextPath("/groups/abc")).toBe("/groups/abc");
  });
});

describe("validatePassword", () => {
  it("enforces 10–72 character passwords", () => {
    expect(validatePassword("short")).toMatch(/at least 10/);
    expect(validatePassword("a".repeat(73))).toMatch(/at most 72/);
    expect(validatePassword("longenough1")).toBeNull();
  });
});

describe("suggestSettlements", () => {
  it("wraps simplifyDebts for settlement suggestions", () => {
    const suggestions = suggestSettlements({ a: -20, b: 20 }, "INR");
    expect(suggestions).toEqual([
      expect.objectContaining({
        fromUserId: "a",
        toUserId: "b",
        amount: 20,
        currency: "INR",
      }),
    ]);
  });
});
