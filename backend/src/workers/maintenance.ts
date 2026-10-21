import { prisma } from "../lib/prisma.js";
import { removeObject } from "../lib/storage.js";
import { emitUsers, emitChannel, lockEventOrder } from "../lib/events.js";
import { lockChannel } from "../lib/access.js";

export async function runMaintenance() {
  const inactiveGroups = await prisma.groupCall.findMany({
    where: {
      endedAt: null,
      createdAt: { lt: new Date(Date.now() - 60000) },
      participants: {
        none: {
          leftAt: null,
          lastSeenAt: { gt: new Date(Date.now() - 45000) },
        },
      },
    },
    take: 20,
    select: { id: true, channelId: true },
  });
  for (const group of inactiveGroups)
    await prisma.$transaction(async (tx) => {
      await lockEventOrder(tx);
      await lockChannel(tx, group.channelId);
      if (
        await tx.groupCallParticipant.count({
          where: {
            callId: group.id,
            leftAt: null,
            lastSeenAt: { gt: new Date(Date.now() - 45000) },
          },
        })
      )
        return;
      await tx.groupCall.updateMany({
        where: { id: group.id, endedAt: null },
        data: { endedAt: new Date() },
      });
      await emitChannel(tx, group.channelId, {
        type: "groupcall.updated",
        targetId: group.id,
      });
    });
  const cutoff = new Date(Date.now() - 86400000);
  const abandoned = await prisma.mediaAsset.findMany({
    where: { messageId: null, createdAt: { lt: cutoff } },
    take: 50,
    select: { id: true },
  });
  await prisma.mediaAsset.deleteMany({
    where: { id: { in: abandoned.map((asset) => asset.id) }, messageId: null },
  });
  const orphans = await prisma.storageObject.findMany({
    where: { createdAt: { lt: cutoff }, asset: null, profile: null },
    orderBy: [{ createdAt: "asc" }, { key: "asc" }],
    take: 50,
  });
  for (const object of orphans) {
    await removeObject(object.key);
    await prisma.storageObject.deleteMany({
      where: { key: object.key, asset: null, profile: null },
    });
  }
  const stale = await prisma.call.findMany({
    where: {
      status: { in: ["active", "ringing"] },
      OR: [
        { expiresAt: { lt: new Date() } },
        { callerSeenAt: { lt: new Date(Date.now() - 45000) } },
        {
          status: "active",
          calleeSeenAt: { lt: new Date(Date.now() - 45000) },
        },
      ],
    },
    take: 20,
    select: { id: true, channelId: true },
  });
  for (const target of stale)
    await prisma.$transaction(async (tx) => {
      await lockEventOrder(tx);
      await lockChannel(tx, target.channelId);
      const call = await tx.call.findFirst({
        where: {
          id: target.id,
          status: { in: ["active", "ringing"] },
          OR: [
            { expiresAt: { lt: new Date() } },
            { callerSeenAt: { lt: new Date(Date.now() - 45000) } },
            {
              status: "active",
              calleeSeenAt: { lt: new Date(Date.now() - 45000) },
            },
          ],
        },
        include: { channel: { select: { workspaceId: true } } },
      });
      if (!call) return;
      await tx.call.update({
        where: { id: call.id },
        data: { status: "ended", offer: null, answer: null },
      });
      await emitUsers(tx, [call.callerId, call.calleeId], {
        type: "call.updated",
        targetId: call.id,
        channelId: call.channelId,
        workspaceId: call.channel.workspaceId,
      });
    });
  // Keep replay for seven days. Clients always perform an authorized catch-up on reconnect.
  const expired = await prisma.userEvent.findMany({
    where: { createdAt: { lt: new Date(Date.now() - 7 * 86400000) } },
    select: { id: true },
    take: 500,
  });
  await prisma.userEvent.deleteMany({
    where: { id: { in: expired.map((event) => event.id) } },
  });
}
