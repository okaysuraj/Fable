import { createHash, randomUUID } from "node:crypto";
import { prisma, sqlTable } from "../lib/prisma.js";
import { PushError, sendPush } from "../lib/push.js";
import { logServerError } from "../lib/telemetry.js";
import { getFirebaseAuth } from "../lib/firebase.js";
import type { UserRecord } from "firebase-admin/auth";

const owner = randomUUID();
const identityChecks = new Map<
  string,
  { expiresAt: number; pending: Promise<UserRecord> }
>();
async function verifyDeviceSession(userId: string, registeredAt: Date) {
  const account = await prisma.account.findUnique({
    where: { userId },
    select: { firebaseUid: true },
  });
  if (!account?.firebaseUid)
    throw new PushError("auth/session-missing", true, true);
  let check = identityChecks.get(account.firebaseUid);
  if (!check || check.expiresAt <= Date.now()) {
    if (identityChecks.size >= 1000) identityChecks.clear();
    check = {
      expiresAt: Date.now() + 30000,
      pending: getFirebaseAuth().getUser(account.firebaseUid),
    };
    identityChecks.set(account.firebaseUid, check);
  }
  try {
    const identity = await check.pending;
    if (
      identity.disabled ||
      (identity.tokensValidAfterTime &&
        new Date(identity.tokensValidAfterTime) > registeredAt)
    )
      throw new PushError("auth/session-revoked", true, true);
  } catch (error) {
    if (error instanceof PushError) throw error;
    if ((error as { code?: string }).code === "auth/user-not-found")
      throw new PushError("auth/user-not-found", true, true);
    throw new PushError("auth/provider-unavailable");
  }
}
function notificationId(eventId: bigint, deviceId: string) {
  const hex = createHash("sha256")
    .update(`${eventId}:${deviceId}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}
async function deliver(id: bigint) {
  const job = await prisma.pushDelivery.findUnique({
    where: { id },
    include: { event: true, device: true },
  });
  if (!job || job.leaseOwner !== owner || job.completedAt) return;
  const { event, device } = job;
  let code: string | null = null;
  let completed = true;
  try {
    const userId = event.userId;
    if (!device.enabled || device.userId !== userId || !event.channelId) return;
    await verifyDeviceSession(userId, device.updatedAt);
    const settings = await prisma.workspaceSetting.findUnique({
      where: { userId },
    });
    const muted = await prisma.conversationNotification.findUnique({
      where: { userId_channelId: { userId, channelId: event.channelId } },
    });
    if (settings?.notificationsEnabled === false || muted?.muted) return;
    const channel = await prisma.channel.findFirst({
      where: {
        id: event.channelId,
        workspace: { members: { some: { userId } } },
        OR: [{ isPrivate: false }, { members: { some: { userId } } }],
      },
      select: { id: true, workspaceId: true },
    });
    if (!channel) return;
    const data: Record<string, string> = {
      eventId: event.id.toString(),
      channelId: channel.id,
      workspaceId: channel.workspaceId,
    };
    let title = "Fable";
    let body = "New message";
    let expiration = Math.floor((event.createdAt.getTime() + 86400000) / 1000);
    const type = event.type === "call.updated" ? "call" : "message";
    if (type === "call") {
      const call = await prisma.call.findFirst({
        where: {
          id: event.targetId,
          calleeId: userId,
          status: "ringing",
          expiresAt: { gt: new Date() },
        },
      });
      if (!call) return;
      const caller = await prisma.user.findUnique({
        where: { id: call.callerId },
        select: { name: true },
      });
      Object.assign(data, {
        type: "call",
        callId: call.id,
        nativeId: call.nativeId,
        callerName: caller?.name || "Fable call",
        kind: call.kind,
      });
      expiration = Math.floor(call.expiresAt.getTime() / 1000);
    } else if (event.type === "groupcall.updated") {
      const call = await prisma.groupCall.findFirst({
        where: {
          id: event.targetId,
          endedAt: null,
          participants: {
            some: {
              leftAt: null,
              lastSeenAt: { gt: new Date(Date.now() - 45000) },
            },
          },
        },
        select: { id: true, kind: true },
      });
      if (!call) return;
      Object.assign(data, { type: "group-call", callId: call.id });
      body = `A group ${call.kind} call has started. Tap to join.`;
      expiration = Math.floor((event.createdAt.getTime() + 60000) / 1000);
    } else {
      const message = await prisma.message.findFirst({
        where: { id: event.targetId, deletedAt: null, channelId: channel.id },
        select: {
          id: true,
          content: true,
          createdAt: true,
          sender: { select: { name: true } },
        },
      });
      if (!message) return;
      const read = await prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId: channel.id, userId } },
        select: { lastReadAt: true, lastReadMessageId: true },
      });
      if (
        read &&
        (read.lastReadAt > message.createdAt ||
          (read.lastReadAt.getTime() === message.createdAt.getTime() &&
            (read.lastReadMessageId || "") >= message.id))
      )
        return;
      Object.assign(data, { type: "message", messageId: message.id });
      if (settings?.notificationPreviews) {
        title = message.sender.name;
        body = message.content.slice(0, 160) || "Sent an attachment";
      }
    }
    if (expiration * 1000 <= Date.now()) return;
    const currentDevice = await prisma.deviceInstallation.findFirst({
      where: { id: device.id, userId, token: device.token, enabled: true },
      select: { id: true },
    });
    if (!currentDevice) return;
    await sendPush(device, {
      type,
      title,
      body,
      data,
      expiration,
      id: notificationId(event.id, device.id),
    });
  } catch (error) {
    code = error instanceof PushError ? error.code : "push/unavailable";
    completed =
      (error instanceof PushError && error.permanent) ||
      job.attempts >= 12 ||
      Date.now() - event.createdAt.getTime() > 86400000;
    if (error instanceof PushError && error.invalidToken)
      await prisma.deviceInstallation.updateMany({
        where: { id: device.id, token: device.token, userId: event.userId },
        data: { enabled: false },
      });
    if (!(error instanceof PushError))
      logServerError("push_delivery_error", error);
  } finally {
    await prisma.pushDelivery.updateMany({
      where: { id, leaseOwner: owner },
      data: {
        completedAt: completed ? new Date() : null,
        errorCode: code,
        leaseUntil: null,
        leaseOwner: null,
        availableAt: new Date(
          Date.now() +
            Math.min(3600000, 5000 * 2 ** Math.min(job.attempts, 10)) +
            Math.floor(Math.random() * 1000),
        ),
      },
    });
  }
}
export async function runDeliveryBatch() {
  const ids = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      { id: bigint }[]
    >`SELECT "id" FROM ${sqlTable("PushDelivery")} WHERE "completedAt" IS NULL AND "availableAt" <= now() AND ("leaseUntil" IS NULL OR "leaseUntil" < now()) ORDER BY "availableAt", "id" FOR UPDATE SKIP LOCKED LIMIT 8`;
    await tx.pushDelivery.updateMany({
      where: { id: { in: rows.map((row) => row.id) } },
      data: {
        leaseOwner: owner,
        leaseUntil: new Date(Date.now() + 90000),
        attempts: { increment: 1 },
      },
    });
    return rows.map((row) => row.id);
  });
  await Promise.all(ids.map(deliver));
}
