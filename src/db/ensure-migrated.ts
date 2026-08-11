import { migrate as runMigrate } from "./migrate-fn";

let migrating: Promise<void> | null = null;

export function migrate() {
  if (!migrating) migrating = runMigrate();
  return migrating;
}
