import { roundMoney } from "./utils";

export type SplitMode = "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES";

export type SplitInput = {
  userId: string;
  amount?: number;
  percent?: number;
  shares?: number;
};

export type PayerInput = {
  userId: string;
  amount: number;
};

export type ComputedSplit = {
  userId: string;
  amount: number;
  percent?: number;
  shares?: number;
};

export function computeSplits(
  total: number,
  mode: SplitMode,
  participants: SplitInput[]
): ComputedSplit[] {
  if (participants.length === 0) {
    throw new Error("At least one participant is required");
  }
  if (total <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  if (mode === "EQUAL") {
    const base = roundMoney(total / participants.length);
    const splits = participants.map((p) => ({
      userId: p.userId,
      amount: base,
    }));
    const sum = roundMoney(splits.reduce((a, s) => a + s.amount, 0));
    const diff = roundMoney(total - sum);
    if (diff !== 0) {
      splits[0].amount = roundMoney(splits[0].amount + diff);
    }
    return splits;
  }

  if (mode === "EXACT") {
    const splits = participants.map((p) => {
      if (p.amount == null || p.amount < 0) {
        throw new Error("Exact split requires non-negative amounts");
      }
      return { userId: p.userId, amount: roundMoney(p.amount) };
    });
    const sum = roundMoney(splits.reduce((a, s) => a + s.amount, 0));
    if (Math.abs(sum - total) > 0.01) {
      throw new Error(`Exact splits (${sum}) must equal total (${total})`);
    }
    return splits;
  }

  if (mode === "PERCENTAGE") {
    const percentSum = participants.reduce((a, p) => a + (p.percent ?? 0), 0);
    if (Math.abs(percentSum - 100) > 0.01) {
      throw new Error("Percentages must sum to 100");
    }
    const splits = participants.map((p) => ({
      userId: p.userId,
      amount: roundMoney((total * (p.percent ?? 0)) / 100),
      percent: p.percent,
    }));
    const sum = roundMoney(splits.reduce((a, s) => a + s.amount, 0));
    const diff = roundMoney(total - sum);
    if (diff !== 0) {
      splits[0].amount = roundMoney(splits[0].amount + diff);
    }
    return splits;
  }

  // SHARES
  const shareTotal = participants.reduce((a, p) => a + (p.shares ?? 0), 0);
  if (shareTotal <= 0) {
    throw new Error("Shares must be greater than zero");
  }
  const splits = participants.map((p) => ({
    userId: p.userId,
    amount: roundMoney((total * (p.shares ?? 0)) / shareTotal),
    shares: p.shares,
  }));
  const sum = roundMoney(splits.reduce((a, s) => a + s.amount, 0));
  const diff = roundMoney(total - sum);
  if (diff !== 0) {
    splits[0].amount = roundMoney(splits[0].amount + diff);
  }
  return splits;
}

export function validatePayers(total: number, payers: PayerInput[]) {
  if (payers.length === 0) throw new Error("At least one payer is required");
  const sum = roundMoney(payers.reduce((a, p) => a + p.amount, 0));
  if (Math.abs(sum - total) > 0.01) {
    throw new Error(`Payer amounts (${sum}) must equal total (${total})`);
  }
}
