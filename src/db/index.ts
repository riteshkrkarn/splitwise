import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

function isRemoteUrl(url: string) {
  return (
    url.startsWith("libsql://") ||
    url.startsWith("https://") ||
    url.startsWith("wss://")
  );
}

function resolveUrl() {
  const url =
    process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

  if (url && isRemoteUrl(url)) return url;

  if (process.env.VERCEL) {
    throw new Error(
      "TURSO_DATABASE_URL is missing on Vercel. Add it (and TURSO_AUTH_TOKEN) in Project Settings → Environment Variables, then redeploy."
    );
  }

  return url || "file:./data/splitwise.db";
}

const url = resolveUrl();

if (url.startsWith("file:") && !process.env.VERCEL) {
  const filePath = url.replace(/^file:/, "");
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(/*turbopackIgnore: true*/ process.cwd(), filePath);
  try {
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  } catch {
    // read-only hosts should use Turso, not a local file
  }
}

export const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export type Db = typeof db;
