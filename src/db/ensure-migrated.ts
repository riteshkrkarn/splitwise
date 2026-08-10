import { migrate as runMigrate } from "./migrate-fn";

let migrated = false;

export function migrate() {
  if (migrated) return;
  runMigrate();
  migrated = true;
}
