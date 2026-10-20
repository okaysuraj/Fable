/** Resolve Firebase or explicitly enabled development identity, then current database membership. */
import { Request, Response, NextFunction } from "express";
import { getFirebaseAuth } from "./firebase.js";
import { prisma } from "./prisma.js";
import { config } from "./config.js";

interface Identity {
  uid: string;
  email: string;
  name?: string;
}

export interface AuthPayload {
  accountId: string;
  userId: string;
  email: string;
  firebaseUid: string;
  workspaceId?: string;
  workspaceRole?: string;
}
export interface AuthRequest extends Request {
  auth?: AuthPayload;
  identity?: Identity;
}

export async function requireIdentity(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !/^Bearer \S+$/.test(header)) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (config.devIdentity) {
    // This marker is deliberately public; it works only on an explicitly opted-in development API.
    if (header !== "Bearer fable-development") {
      res.status(401).json({ error: "Use the local development session" });
      return;
    }
    req.identity = config.devIdentity;
    next();
    return;
  }
  if (header === "Bearer fable-development") {
    res.status(401).json({ error: "Development authentication is disabled" });
    return;
  }
  try {
    const identity = await getFirebaseAuth().verifyIdToken(
      header.slice(7),
      true,
    );
    if (
      !["password", "google.com"].includes(identity.firebase.sign_in_provider)
    ) {
      res.status(403).json({
        code: "AUTH_PROVIDER_UNSUPPORTED",
        error: "Sign in with email/password or Google",
      });
      return;
    }
    if (!identity.email_verified || !identity.email) {
      res.status(403).json({
        code: "EMAIL_VERIFICATION_REQUIRED",
        error: "Verify your email before accessing Fable",
      });
      return;
    }
    req.identity = {
      uid: identity.uid,
      email: identity.email,
      name: identity.name,
    };
    next();
  } catch (error) {
    const code = (error as { code?: string }).code || "";
    if (
      [
        "auth/id-token-expired",
        "auth/id-token-revoked",
        "auth/invalid-id-token",
        "auth/argument-error",
        "auth/user-disabled",
        "auth/user-not-found",
      ].includes(code)
    ) {
      res
        .status(401)
        .json({ error: "Invalid or expired authentication session" });
      return;
    }
    next(error);
  }
}

export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  void requireIdentity(req, res, (error) => {
    if (error) {
      next(error);
      return;
    }
    void attachDatabaseIdentity(req, res, next);
  });
}
async function attachDatabaseIdentity(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const identity = req.identity!;
    const account = await prisma.account.findUnique({
      where: { firebaseUid: identity.uid },
      select: {
        id: true,
        userId: true,
        email: true,
        user: { select: { lastSeenAt: true } },
      },
    });
    if (!account) {
      res.status(403).json({ error: "Create your Fable session first" });
      return;
    }
    const workspaceHeader = req.headers["x-workspace-id"];
    if (workspaceHeader && typeof workspaceHeader !== "string") {
      res.status(400).json({ error: "Invalid workspace header" });
      return;
    }
    // Membership discovery/recovery must work even when a saved active workspace was removed.
    // Audit and all tenant resources still enforce the supplied active workspace.
    const workspacePath = req.path.replace(/\/$/, "") || "/";
    const independentWorkspaceRead =
      req.baseUrl === "/api/workspace" &&
      ((req.method === "GET" &&
        (workspacePath === "/" ||
          (/^\/[^/]+$/.test(workspacePath) &&
            !["/audit", "/invitations"].includes(workspacePath)))) ||
        (req.method === "POST" && ["/", "/join"].includes(workspacePath)));
    const personalRoute =
      req.baseUrl === "/api/auth" || req.baseUrl === "/api/settings" || req.baseUrl === "/api/contacts" || (req.baseUrl === "/api/channels" && req.method === "POST" && req.path === "/groups");
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId: account.userId,
        ...(!independentWorkspaceRead && !personalRoute && workspaceHeader
          ? { workspaceId: workspaceHeader }
          : {}),
      },
      orderBy: [{ createdAt: "asc" }, { workspaceId: "asc" }],
    });
    if (!membership && !independentWorkspaceRead && !personalRoute) {
      res.status(403).json({ error: "Workspace access required" });
      return;
    }
    if (
      !account.user.lastSeenAt ||
      Date.now() - account.user.lastSeenAt.getTime() > 60000
    ) {
      await prisma.user.updateMany({
        where: {
          id: account.userId,
          OR: [
            { lastSeenAt: null },
            { lastSeenAt: { lt: new Date(Date.now() - 60000) } },
          ],
        },
        data: { lastSeenAt: new Date() },
      });
    }
    req.auth = {
      accountId: account.id,
      userId: account.userId,
      email: identity.email.toLowerCase(),
      firebaseUid: identity.uid,
      workspaceId: membership?.workspaceId,
      workspaceRole: membership?.role,
    };
    next();
  } catch (error) {
    next(error);
  }
}
