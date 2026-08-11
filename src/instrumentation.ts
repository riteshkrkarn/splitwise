export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (process.env.VERCEL && !process.env.TURSO_DATABASE_URL) return;
  const { migrate } = await import("@/db/ensure-migrated");
  await migrate();
}
