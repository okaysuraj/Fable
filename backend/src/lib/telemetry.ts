import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

// Never log URL queries, authorization headers, request bodies or provider errors:
// each can contain credentials, invitation secrets or private conversation text.
export const requestTelemetry: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  const started = performance.now();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("Cache-Control", "no-store");
  res.once("finish", () => {
    const route = req.route?.path;
    console.info(
      JSON.stringify({
        event: "http_request",
        requestId,
        method: req.method,
        route:
          typeof route === "string" ? `${req.baseUrl}${route}` : "unmatched",
        status: res.statusCode,
        durationMs: Math.round(performance.now() - started),
      }),
    );
  });
  next();
};

export function logServerError(
  event: string,
  error: unknown,
  requestId?: string,
) {
  const safe = error as { name?: unknown; code?: unknown } | null;
  const code =
    typeof safe?.code === "string" && /^[A-Za-z0-9_/-]{1,80}$/.test(safe.code)
      ? safe.code
      : undefined;
  console.error(
    JSON.stringify({
      event,
      requestId,
      errorType: error instanceof Error ? error.name : "UnknownError",
      code,
    }),
  );
}
