/** Every protected request resolves a verified Firebase identity and current database membership. */
import { Request, Response, NextFunction } from "express";
import { DecodedIdToken } from "firebase-admin/auth";
import { firebaseAuth } from "./firebase.js";
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
  firebaseUser?: DecodedIdToken;
}

export async function requireFirebaseAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !/^Bearer \S+$/.test(header)) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const identity = await firebaseAuth.verifyIdToken(header.slice(7), true);
    if (
      !identity.email_verified ||
      !identity.email ||
      identity.firebase.sign_in_provider !== "password"
    ) {
      res
        .status(403)
        .json({ error: "Verify your email before accessing Fable" });
      return;
    }
    req.firebaseUser = identity;
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
  void requireFirebaseAuth(req, res, (error) => {
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
    const identity = req.firebaseUser!;
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
      res
        .status(403)
        .json({ error: "Create your verified Fable session first" });
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
      req.baseUrl === "/api/auth" || req.baseUrl === "/api/settings";
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
      email: identity.email!.toLowerCase(),
      firebaseUid: identity.uid,
      workspaceId: membership?.workspaceId,
      workspaceRole: membership?.role,
    };
    next();
  } catch (error) {
    next(error);
  }
}
