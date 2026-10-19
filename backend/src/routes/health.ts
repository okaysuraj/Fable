/** Separate process liveness from database readiness without exposing infrastructure details. */
import { Router, Request, Response } from "express";
import { checkDatabaseConnection } from "../lib/prisma.js";

export const healthRouter = Router();

const startTime = Date.now();

healthRouter.get("/live", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "fable-express-backend" });
});

healthRouter.get(["/", "/ready"], async (_req: Request, res: Response) => {
  const isDbLive = await checkDatabaseConnection();
  res.status(isDbLive ? 200 : 503).json({
    status: isDbLive ? "ok" : "unavailable",
    service: "fable-express-backend",
    version: "1.0.0",
    database: isDbLive ? "postgresql_connected" : "disconnected",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});
