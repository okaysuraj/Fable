/** Per-account abuse budgets protect expensive operations on the single-instance deployment. */
import { rateLimit } from "express-rate-limit";
import { AuthRequest } from "./auth.js";

export function createAuthenticatedLimiter(
  options: { limit?: number; windowMs?: number } = {},
) {
  return rateLimit({
    windowMs: options.windowMs ?? 60000,
    limit: options.limit ?? 240,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => {
      const userId = (req as AuthRequest).auth?.userId;
      if (!userId)
        throw new Error(
          "Authenticated rate limiter requires a verified database identity",
        );
      return userId;
    },
    message: { error: "Too many requests for this account; try again shortly" },
  });
}

// One shared per-user store covers every protected route, including /auth/me.
export const authenticatedLimiter = createAuthenticatedLimiter();
