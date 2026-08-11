import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { migrate } from "@/db/ensure-migrated";
import { exchangeRates } from "@/db/schema";
import { createId } from "@/lib/id";
import { roundMoney } from "@/lib/utils";

const FALLBACK_RATES_USD: Record<string, number> = {
  USD: 1,
  INR: 83.5,
  EUR: 0.92,
  GBP: 0.79,
  AUD: 1.53,
  CAD: 1.36,
  SGD: 1.34,
  JPY: 149,
  AED: 3.67,
  CHF: 0.88,
  CNY: 7.24,
  HKD: 7.82,
  NZD: 1.66,
  THB: 35.5,
  MYR: 4.7,
};

async function fetchLiveRates(base: string): Promise<Record<string, number> | null> {
  const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID;
  if (!appId) return null;
  try {
    const res = await fetch(
      `https://openexchangerates.org/api/latest.json?app_id=${appId}&base=${base}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { rates: Record<string, number> };
    return data.rates;
  } catch {
    return null;
  }
}

export async function getRates(base = "USD"): Promise<Record<string, number>> {
  await migrate();
  const today = new Date().toISOString().slice(0, 10);
  const cached = await db
    .select()
    .from(exchangeRates)
    .where(and(eq(exchangeRates.base, base), eq(exchangeRates.date, today)))
    .get();
  if (cached) return JSON.parse(cached.rates) as Record<string, number>;

  const live = await fetchLiveRates(base);
  const rates = live ?? (base === "USD" ? FALLBACK_RATES_USD : convertFallback(base));

  try {
    await db.insert(exchangeRates)
      .values({
        id: createId("fx"),
        base,
        rates: JSON.stringify(rates),
        date: today,
        createdAt: new Date(),
      })
      ;
  } catch {
    // unique constraint — already cached
  }

  return rates;
}

function convertFallback(base: string): Record<string, number> {
  const baseRate = FALLBACK_RATES_USD[base] ?? 1;
  const out: Record<string, number> = {};
  for (const [code, usdRate] of Object.entries(FALLBACK_RATES_USD)) {
    out[code] = usdRate / baseRate;
  }
  return out;
}

export async function convertAmount(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  if (from === to) return amount;
  const rates = await getRates("USD");
  const fromRate = rates[from] ?? FALLBACK_RATES_USD[from] ?? 1;
  const toRate = rates[to] ?? FALLBACK_RATES_USD[to] ?? 1;
  // rates are vs USD when from API with base USD; FALLBACK is also vs USD
  const inUsd = amount / fromRate;
  return roundMoney(inUsd * toRate);
}
