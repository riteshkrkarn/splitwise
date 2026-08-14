import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { createId } from "@/lib/id";

const WINDOW_MS = 15 * 60 * 1000;

export async function checkRateLimit(
  key: string,
  limit: number
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const now = Date.now();
  const row = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).get();

  if (!row || now - row.windowStart.getTime() >= WINDOW_MS) {
    if (row) {
      await db
        .update(rateLimits)
        .set({ count: 1, windowStart: new Date(now) })
        .where(eq(rateLimits.id, row.id));
    } else {
      await db.insert(rateLimits).values({
        id: createId("rl"),
        key,
        count: 1,
        windowStart: new Date(now),
      });
    }
    return { ok: true };
  }

  if (row.count >= limit) {
    const retryAfterSec = Math.ceil(
      (WINDOW_MS - (now - row.windowStart.getTime())) / 1000
    );
    return { ok: false, retryAfterSec };
  }

  await db
    .update(rateLimits)
    .set({ count: row.count + 1 })
    .where(and(eq(rateLimits.id, row.id), gt(rateLimits.count, -1)));

  return { ok: true };
}

export function safeNextPath(
  raw: FormDataEntryValue | null,
  origin = process.env.APP_URL ?? "http://localhost:3000"
) {
  const next = String(raw ?? "/dashboard").trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/dashboard";
  }
  if (/%2f|%5c|@/i.test(next)) {
    return "/dashboard";
  }
  try {
    const base = new URL(origin);
    const resolved = new URL(next, base);
    if (resolved.origin !== base.origin) return "/dashboard";
    return `${resolved.pathname}${resolved.search}${resolved.hash}` || "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export function validatePassword(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (password.length > 72) return "Password must be at most 72 characters.";
  return null;
}
