import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

const dbPath =
  process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./data/splitwise.db";
const absolutePath = path.isAbsolute(dbPath)
  ? dbPath
  : path.join(/*turbopackIgnore: true*/ process.cwd(), dbPath);

fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

const sqlite = new Database(absolutePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const rawSqlite = sqlite;
export const db = drizzle(sqlite, { schema });
export type Db = typeof db;
