import { runDeliveryBatch } from "./delivery.js";
import { runMaintenance } from "./maintenance.js";
import { logServerError } from "../lib/telemetry.js";

export function startWorker() {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<void> = Promise.resolve();
  let maintainedAt = 0;
  const tick = async () => {
    if (stopped) return;
    try {
      await runDeliveryBatch();
      if (Date.now() - maintainedAt > 30000) {
        await runMaintenance();
        maintainedAt = Date.now();
      }
    } catch (error) {
      logServerError("worker_error", error);
    }
    if (!stopped)
      timer = setTimeout(() => {
        active = tick();
      }, 1500);
  };
  active = tick();
  return async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    await active;
  };
}
