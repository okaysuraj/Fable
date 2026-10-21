import { prisma } from "./lib/prisma.js";
import { checkStorage } from "./lib/storage.js";
import { startWorker } from "./workers/runtime.js";
import { logServerError } from "./lib/telemetry.js";

async function main() {
  await prisma.$connect();
  await checkStorage();
  const stop = startWorker();
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    void stop()
      .then(() => prisma.$disconnect())
      .then(() => process.exit(0));
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  console.info("Fable notification and media maintenance worker started");
}
main().catch((error) => {
  logServerError("worker_startup_error", error);
  process.exitCode = 1;
});
