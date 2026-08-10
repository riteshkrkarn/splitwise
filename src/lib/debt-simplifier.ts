import { simplifyDebts, type LedgerEntry } from "./balances";

export function suggestSettlements(
  netByUser: Record<string, number>,
  currency: string
): LedgerEntry[] {
  return simplifyDebts(new Map(Object.entries(netByUser)), currency);
}
