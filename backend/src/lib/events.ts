import type { Prisma } from "@prisma/client";

export type EventType =
  | "message.created"
  | "message.updated"
  | "profile.updated"
  | "call.updated"
  | "groupcall.updated"
  | "settings.updated";
type EventInput = {
  type: EventType;
  targetId: string;
  channelId?: string;
  workspaceId?: string;
  notify?: boolean;
  excludePushUserId?: string;
};
export async function lockEventOrder(tx: Prisma.TransactionClient) {
  // Initial single-database deployment: serialize event-producing transactions before resource locks.
  // This prevents both late-commit cursor gaps and lock inversion with profile foreign keys.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fable-event-commit-order'))`;
}

/** Must be the last writing phase of a business transaction. This lock orders IDs by commit. */
export async function emitUsers(
  tx: Prisma.TransactionClient,
  recipients: string[],
  input: EventInput,
) {
  if (!recipients.length) return;
  await lockEventOrder(tx);
  const { notify, excludePushUserId, ...data } = input;
  // Sorted recipients keep fan-out deterministic. Each user gets a private replay stream.
  const events = await tx.userEvent.createManyAndReturn({
    data: [...new Set(recipients)]
      .sort()
      .map((userId) => ({ userId, ...data })),
    select: { id: true, userId: true },
  });
  if (notify) {
    const devices = await tx.deviceInstallation.findMany({
      where: {
        userId: {
          in: events
            .map((event) => event.userId)
            .filter((id) => id !== excludePushUserId),
        },
        enabled: true,
      },
      select: { id: true, userId: true },
    });
    const eventByUser = new Map(
      events.map((event) => [event.userId, event.id]),
    );
    if (devices.length)
      await tx.pushDelivery.createMany({
        data: devices.map((device) => ({
          deviceId: device.id,
          eventId: eventByUser.get(device.userId)!,
        })),
        skipDuplicates: true,
      });
  }
  const users = [...new Set(recipients)];
  for (let index = 0; index < users.length; index += 100)
    await tx.$executeRaw`SELECT pg_notify('fable_events', ${JSON.stringify(users.slice(index, index + 100))})`;
}
export async function emitChannel(
  tx: Prisma.TransactionClient,
  channelId: string,
  input: Omit<EventInput, "channelId" | "workspaceId">,
) {
  const channel = await tx.channel.findUniqueOrThrow({
    where: { id: channelId },
    select: { workspaceId: true, isPrivate: true },
  });
  const members = await tx.workspaceMember.findMany({
    where: {
      workspaceId: channel.workspaceId,
      ...(channel.isPrivate
        ? { user: { channels: { some: { channelId } } } }
        : {}),
    },
    select: { userId: true },
  });
  await emitUsers(
    tx,
    members.map((member) => member.userId),
    { ...input, channelId, workspaceId: channel.workspaceId },
  );
}
export async function emitProfile(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const members = await tx.workspaceMember.findMany({
    where: { workspace: { members: { some: { userId } } } },
    select: { userId: true },
    distinct: ["userId"],
  });
  await emitUsers(tx, [userId, ...members.map((member) => member.userId)], {
    type: "profile.updated",
    targetId: userId,
  });
}
