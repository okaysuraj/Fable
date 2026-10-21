/** Separate process liveness from database readiness without exposing infrastructure details. */
import { Router, Request, Response } from "express";
import { checkDatabaseConnection } from "../lib/prisma.js";
import { eventListenerReady } from "../lib/eventListener.js";
import { sfuReady } from "../lib/sfu.js";

export const healthRouter = Router();

const startTime = Date.now();

healthRouter.get("/live", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "fable-express-backend" });
});

healthRouter.get(["/", "/ready"], async (_req: Request, res: Response) => {
  const isDbLive = await checkDatabaseConnection();
  const realtimeReady = eventListenerReady();
  const mediaReady = sfuReady();
  const ready = isDbLive && realtimeReady && mediaReady;
  res.status(ready ? 200 : 503).json({
    status: ready ? "ok" : "unavailable",
    service: "fable-express-backend",
    version: "1.0.0",
    database: isDbLive ? "postgresql_connected" : "disconnected",
    realtime: realtimeReady ? "connected" : "disconnected",
    calling: mediaReady ? "ready" : "recovering",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});
