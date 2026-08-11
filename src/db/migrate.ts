import { migrate } from "./migrate-fn";

async function main() {
  await migrate();
  console.log("Schema ready");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
