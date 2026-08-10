import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MAX_GROUP_MEMBERS = 5;
export const AVATAR_IDS = [1, 2, 3, 4, 5] as const;

export const CATEGORIES = [
  "General",
  "Food & Drink",
  "Groceries",
  "Transport",
  "Rent",
  "Utilities",
  "Entertainment",
  "Travel",
  "Shopping",
  "Health",
  "Other",
] as const;

export const CURRENCIES = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "CAD",
  "SGD",
  "JPY",
  "AED",
  "CHF",
  "CNY",
  "HKD",
  "NZD",
  "THB",
  "MYR",
] as const;

export function avatarSrc(id: number) {
  const safe = AVATAR_IDS.includes(id as (typeof AVATAR_IDS)[number])
    ? id
    : 1;
  return `/avatars/avatar-${safe}.svg`;
}

export function formatMoney(amount: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function roundMoney(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
