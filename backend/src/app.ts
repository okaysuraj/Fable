/** HTTP composition only: middleware, authenticated feature routers and safe public errors. */
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { config } from "./lib/config.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { channelsRouter } from "./routes/channels.js";
import { callsRouter } from "./routes/calls.js";
import { mediaRouter } from "./routes/media.js";
import { messagesRouter } from "./routes/messages.js";
import { teamRouter } from "./routes/team.js";
import { contactsRouter } from "./routes/contacts.js";
import { devicesRouter } from "./routes/devices.js";
import { groupCallsRouter } from "./routes/groupCalls.js";
import { settingsRouter } from "./routes/settings.js";
import { workspaceRouter } from "./routes/workspace.js";
import { requireAuth } from "./lib/auth.js";
import { databaseErrorStatus, HttpError } from "./lib/http.js";
import { authenticatedLimiter } from "./lib/rateLimits.js";
import { logServerError, requestTelemetry } from "./lib/telemetry.js";

export const app = express();
app.disable("x-powered-by");
app.use(requestTelemetry);
if (process.env.TRUST_PROXY_HOPS) {
  const hops = Number(process.env.TRUST_PROXY_HOPS);
  if (!Number.isInteger(hops) || hops < 0 || hops > 10)
    throw new Error("TRUST_PROXY_HOPS must be 0..10");
  app.set("trust proxy", hops);
}
app.use(helmet());
app.use(
  cors({
    origin: config.origins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Workspace-Id"],
    exposedHeaders: ["X-Request-Id"],
  }),
);
app.use(express.json({ limit: "64kb" }));
app.use(
  rateLimit({
    windowMs: 60000,
    limit: 1000,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) =>
      ["/api/health", "/api/health/live", "/api/health/ready"].includes(
        req.path,
      ),
    message: { error: "Too many requests; try again shortly" },
  }),
);
app.use("/api/health", healthRouter);
const authLimiter = rateLimit({
  windowMs: 15 * 60000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many authentication attempts; try again later" },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/session", authLimiter);
app.use("/api/auth", authRouter);
app.use("/api/channels", requireAuth, authenticatedLimiter, channelsRouter);
app.use("/api/calls", requireAuth, authenticatedLimiter, callsRouter);
app.use("/api/media", requireAuth, authenticatedLimiter, mediaRouter);
app.use("/api/messages", requireAuth, authenticatedLimiter, messagesRouter);
app.use("/api/team", requireAuth, authenticatedLimiter, teamRouter);
app.use("/api/contacts", requireAuth, authenticatedLimiter, contactsRouter);
app.use("/api/devices", requireAuth, authenticatedLimiter, devicesRouter);
app.use(
  "/api/group-calls",
  requireAuth,
  authenticatedLimiter,
  groupCallsRouter,
);
app.use("/api/settings", requireAuth, authenticatedLimiter, settingsRouter);
app.use("/api/workspace", requireAuth, authenticatedLimiter, workspaceRouter);
app.get("/", (_req, res) => {
  res.json({ name: "Fable API", version: "1.0.0" });
});
app.use((_req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});
app.use(
  (
    error: Error & { status?: number; type?: string },
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    const status =
      error instanceof HttpError
        ? error.status
        : error.type === "entity.too.large"
          ? 413
          : error.type === "entity.parse.failed"
            ? 400
            : databaseErrorStatus(error) || 500;
    if (status >= 500) logServerError("api_error", error, res.locals.requestId);
    if (res.headersSent || res.destroyed) {
      if (!res.destroyed) res.destroy();
      return;
    }
    const message =
      error instanceof HttpError
        ? error.message
        : status >= 500
          ? "Service temporarily unavailable"
          : status === 409
            ? "Resource already exists"
            : status === 404
              ? "Resource not found"
              : status === 413
                ? "Request body too large"
                : status === 400
                  ? "Invalid JSON request"
                  : "Request could not be completed";
    res
      .status(status)
      .json({ error: message, requestId: res.locals.requestId });
  },
);
export default app;
