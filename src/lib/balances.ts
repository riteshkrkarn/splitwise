import { roundMoney } from "./utils";

export type LedgerEntry = {
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
};

/** Net balance per user: positive = others owe them, negative = they owe others */
export function computeNetBalances(
  expenses: Array<{
    currency: string;
    payers: Array<{ userId: string; amount: number }>;
    splits: Array<{ userId: string; amount: number }>;
  }>,
  settlements: Array<{
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
  }>,
  ious: Array<{
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
  }> = []
): Map<string, Map<string, number>> {
  // currency -> userId -> net
  const byCurrency = new Map<string, Map<string, number>>();

  const bump = (currency: string, userId: string, delta: number) => {
    if (!byCurrency.has(currency)) byCurrency.set(currency, new Map());
    const m = byCurrency.get(currency)!;
    m.set(userId, roundMoney((m.get(userId) ?? 0) + delta));
  };

  for (const e of expenses) {
    for (const p of e.payers) bump(e.currency, p.userId, p.amount);
    for (const s of e.splits) bump(e.currency, s.userId, -s.amount);
  }

  // Settlement: from pays to → from's debt decreases (balance up), to's credit decreases
  for (const s of settlements) {
    bump(s.currency, s.fromUserId, s.amount);
    bump(s.currency, s.toUserId, -s.amount);
  }

  // IOU: from owes to → same as expense where to paid and from owes
  for (const iou of ious) {
    bump(iou.currency, iou.toUserId, iou.amount);
    bump(iou.currency, iou.fromUserId, -iou.amount);
  }

  return byCurrency;
}

/** Pairwise: positive means A is owed by B (B owes A) */
export function computePairwiseBalances(
  expenses: Array<{
    currency: string;
    payers: Array<{ userId: string; amount: number }>;
    splits: Array<{ userId: string; amount: number }>;
  }>,
  settlements: Array<{
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
  }>,
  ious: Array<{
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
  }> = []
): Map<string, Map<string, number>> {
  // currency -> "a|b" sorted key unused; use nested map a -> b -> amount B owes A
  const byCurrency = new Map<string, Map<string, Map<string, number>>>();

  const adjust = (
    currency: string,
    debtor: string,
    creditor: string,
    amount: number
  ) => {
    if (debtor === creditor || amount === 0) return;
    if (!byCurrency.has(currency)) byCurrency.set(currency, new Map());
    const root = byCurrency.get(currency)!;
    if (!root.has(creditor)) root.set(creditor, new Map());
    if (!root.has(debtor)) root.set(debtor, new Map());
    const cMap = root.get(creditor)!;
    const dMap = root.get(debtor)!;
    cMap.set(debtor, roundMoney((cMap.get(debtor) ?? 0) + amount));
    dMap.set(creditor, roundMoney((dMap.get(creditor) ?? 0) - amount));
  };

  for (const e of expenses) {
    const payerShare = new Map(e.payers.map((p) => [p.userId, p.amount]));
    const splitShare = new Map(e.splits.map((s) => [s.userId, s.amount]));
    const users = new Set([...payerShare.keys(), ...splitShare.keys()]);

    // Simplified: each person's net on this expense
    for (const u of users) {
      const paid = payerShare.get(u) ?? 0;
      const owed = splitShare.get(u) ?? 0;
      const net = roundMoney(paid - owed);
      if (net === 0) continue;
      // Distribute net against others proportionally is complex;
      // use pairwise via net balances simplification instead for display.
    }

    // Direct approach: for each splittee and each payer, allocate
    const totalPaid = e.payers.reduce((a, p) => a + p.amount, 0) || 1;
    for (const split of e.splits) {
      for (const payer of e.payers) {
        const portion = (payer.amount / totalPaid) * split.amount;
        // split.user owes portion to payer
        adjust(e.currency, split.userId, payer.userId, portion);
      }
    }
  }

  for (const s of settlements) {
    // from paid to → reduces what from owes to
    adjust(s.currency, s.fromUserId, s.toUserId, -s.amount);
  }

  for (const iou of ious) {
    adjust(iou.currency, iou.fromUserId, iou.toUserId, iou.amount);
  }

  // Flatten to currency -> userId -> net (for convenience return net map)
  return computeNetBalances(expenses, settlements, ious);
}

/** Direct who-owes-whom, without simplifying through a third person. */
export function computePairwiseDebts(
  expenses: Array<{
    currency: string;
    payers: Array<{ userId: string; amount: number }>;
    splits: Array<{ userId: string; amount: number }>;
  }>,
  settlements: Array<{
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
  }>,
  ious: Array<{
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
  }> = []
): Map<string, LedgerEntry[]> {
  const byCurrency = new Map<string, Map<string, Map<string, number>>>();

  const bump = (
    currency: string,
    fromUserId: string,
    toUserId: string,
    amount: number
  ) => {
    if (fromUserId === toUserId || amount === 0) return;
    if (!byCurrency.has(currency)) byCurrency.set(currency, new Map());
    const root = byCurrency.get(currency)!;
    if (!root.has(fromUserId)) root.set(fromUserId, new Map());
    const row = root.get(fromUserId)!;
    row.set(toUserId, roundMoney((row.get(toUserId) ?? 0) + amount));
  };

  for (const e of expenses) {
    const totalPaid = e.payers.reduce((a, p) => a + p.amount, 0) || 1;
    for (const split of e.splits) {
      for (const payer of e.payers) {
        bump(
          e.currency,
          split.userId,
          payer.userId,
          (payer.amount / totalPaid) * split.amount
        );
      }
    }
  }

  for (const s of settlements) {
    bump(s.currency, s.fromUserId, s.toUserId, -s.amount);
  }

  for (const iou of ious) {
    bump(iou.currency, iou.fromUserId, iou.toUserId, iou.amount);
  }

  const result = new Map<string, LedgerEntry[]>();
  for (const [currency, fromMap] of byCurrency) {
    const seen = new Set<string>();
    const debts: LedgerEntry[] = [];
    for (const [fromId, toMap] of fromMap) {
      for (const [toId] of toMap) {
        const key = fromId < toId ? `${fromId}|${toId}` : `${toId}|${fromId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const aToB = fromMap.get(fromId)?.get(toId) ?? 0;
        const bToA = fromMap.get(toId)?.get(fromId) ?? 0;
        const net = roundMoney(aToB - bToA);
        if (net > 0.009) {
          debts.push({
            fromUserId: fromId,
            toUserId: toId,
            amount: net,
            currency,
          });
        } else if (net < -0.009) {
          debts.push({
            fromUserId: toId,
            toUserId: fromId,
            amount: roundMoney(-net),
            currency,
          });
        }
      }
    }
    debts.sort((a, b) => b.amount - a.amount);
    result.set(currency, debts);
  }
  return result;
}

export type BalanceSummary = {
  currency: string;
  netByUser: Record<string, number>;
  debts: LedgerEntry[];
  pairwiseDebts: LedgerEntry[];
};

export function summarizeBalances(
  netByCurrency: Map<string, Map<string, number>>,
  simplify: boolean,
  pairwiseByCurrency: Map<string, LedgerEntry[]> = new Map()
): BalanceSummary[] {
  const result: BalanceSummary[] = [];
  for (const [currency, netMap] of netByCurrency) {
    const netByUser = Object.fromEntries(netMap);
    const debts = simplify
      ? simplifyDebts(netMap, currency)
      : pairwiseFromNet(netMap, currency);
    result.push({
      currency,
      netByUser,
      debts,
      pairwiseDebts: pairwiseByCurrency.get(currency) ?? debts,
    });
  }
  return result;
}

function pairwiseFromNet(
  netMap: Map<string, number>,
  currency: string
): LedgerEntry[] {
  // Prefer simplify algorithm for the debt list view.
  return simplifyDebts(netMap, currency);
}

/** Min cash-flow: greedy match largest debtor to largest creditor */
export function simplifyDebts(
  netMap: Map<string, number>,
  currency: string
): LedgerEntry[] {
  const debtors = [...netMap.entries()]
    .filter(([, v]) => v < -0.009)
    .map(([id, v]) => ({ id, amount: roundMoney(-v) }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = [...netMap.entries()]
    .filter(([, v]) => v > 0.009)
    .map(([id, v]) => ({ id, amount: v }))
    .sort((a, b) => b.amount - a.amount);

  const result: LedgerEntry[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay > 0.009) {
      result.push({
        fromUserId: debtors[i].id,
        toUserId: creditors[j].id,
        amount: roundMoney(pay),
        currency,
      });
    }
    debtors[i].amount = roundMoney(debtors[i].amount - pay);
    creditors[j].amount = roundMoney(creditors[j].amount - pay);
    if (debtors[i].amount <= 0.009) i++;
    if (creditors[j].amount <= 0.009) j++;
  }
  return result;
}
