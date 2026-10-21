/** Connect dependencies before listening, then drain HTTP and database work on shutdown. */
import { app } from "./app.js";
import { config } from "./lib/config.js";
import { prisma } from "./lib/prisma.js";
import { logServerError } from "./lib/telemetry.js";
import { checkStorage } from "./lib/storage.js";
import { attachRealtime } from "./realtime.js";
import { startWorker } from "./workers/runtime.js";
import { startSfu, stopSfu, reapSfu } from "./lib/sfu.js";
import { startEventListener } from "./lib/eventListener.js";

async function start() {
  await prisma.$connect();
  await checkStorage();
  await startSfu();
  const server = app.listen(config.port, config.host, () =>
    console.log(`Fable API listening on port ${config.port}`),
  );
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  const stopRealtime = attachRealtime(server);
  const stopEvents = startEventListener();
  const stopWorker =
    process.env.WORKER_EMBEDDED === "false" ? async () => {} : startWorker();
  const sfuReaper = setInterval(() => {
    void reapSfu().catch((error) => logServerError("sfu_cleanup_error", error));
  }, 5000);
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    stopRealtime();
    clearInterval(sfuReaper);
    stopSfu();
    const deadline = setTimeout(() => {
      server.closeAllConnections();
      process.exit(1);
    }, 10000).unref();
    server.close(() => {
      void Promise.all([stopWorker(), stopEvents()])
        .then(() => prisma.$disconnect())
        .then(() => {
          clearTimeout(deadline);
          process.exit(0);
        })
        .catch((error) => {
          logServerError("shutdown_error", error);
          process.exit(1);
        });
    });
    server.closeIdleConnections();
  }
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
start().catch((error) => {
  logServerError("startup_error", error);
  process.exitCode = 1;
});
