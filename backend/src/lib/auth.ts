/** Verify Firebase identity, then resolve current database membership. */
import { Request, Response, NextFunction } from "express";
import {
  verifyFirebaseIdentity,
  FirebaseIdentityError,
  type VerifiedIdentity,
} from "./firebase.js";
import { prisma } from "./prisma.js";

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
  identity?: VerifiedIdentity;
}

export async function requireIdentity(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !/^Bearer \S+$/.test(header)) {
    res
      .status(401)
      .json({ code: "AUTH_REQUIRED", error: "Authentication required" });
    return;
  }
  try {
    req.identity = await verifyFirebaseIdentity(header.slice(7));
    next();
  } catch (error) {
    if (error instanceof FirebaseIdentityError) {
      res.status(error.status).json({ code: error.code, error: error.message });
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
      req.baseUrl === "/api/auth" ||
      req.baseUrl === "/api/settings" ||
      req.baseUrl === "/api/devices" ||
      req.baseUrl === "/api/group-calls" ||
      req.baseUrl === "/api/contacts" ||
      (req.baseUrl === "/api/calls" &&
        (req.method === "GET" ||
          (req.method === "POST" && /^\/[^/]+$/.test(workspacePath)))) ||
      (req.baseUrl === "/api/channels" &&
        ((req.method === "POST" && req.path === "/groups") ||
          (req.method === "GET" &&
            req.path === "/" &&
            req.query.allWorkspaces === "true")));
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
