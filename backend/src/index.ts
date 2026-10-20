/** Connect dependencies before listening, then drain HTTP and database work on shutdown. */
import { app } from "./app.js";
import { config } from "./lib/config.js";
import { prisma } from "./lib/prisma.js";
import { logServerError } from "./lib/telemetry.js";

async function start() {
  await prisma.$connect();
  if (config.devIdentity)
    console.warn(
      "Development authentication enabled: local account access does not require Firebase.",
    );
  const server = app.listen(config.port, "0.0.0.0", () =>
    console.log(`Fable API listening on port ${config.port}`),
  );
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => {
      server.closeAllConnections();
      process.exit(1);
    }, 10000).unref();
    server.close(() => {
      void prisma
        .$disconnect()
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
