export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { migrate } = await import("@/db/ensure-migrated");
  await migrate();
}