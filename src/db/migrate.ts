import { migrate } from "./migrate-fn";

migrate();
console.log("SQLite schema ready at data/splitwise.db");
