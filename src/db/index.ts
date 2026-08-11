import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

function resolveUrl() {
  return (
    process.env.TURSO_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "file:./data/splitwise.db"
  );
}

const url = resolveUrl();

if (url.startsWith("file:")) {
  const filePath = url.replace(/^file:/, "");
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(/*turbopackIgnore: true*/ process.cwd(), filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
}

export const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export type Db = typeof db;
