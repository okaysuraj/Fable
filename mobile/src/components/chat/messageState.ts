import type { Message, User } from "@/types/chat";

const compareMessages = (left: Message, right: Message) => {
  const time =
    left.timestamp < right.timestamp
      ? -1
      : left.timestamp > right.timestamp
        ? 1
        : 0;
  return time || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
};

/** Concurrent history/pin snapshots must replay changes from the earlier durable checkpoint. */
export function earliestChangeCursor(left: string, right: string): string {
  return BigInt(left) < BigInt(right) ? left : right;
}

/** A discarded snapshot body may no longer exist locally; retry its bounded page instead. */
export function hasStaleMessageSnapshot(
  incoming: Message[],
  versions: ReadonlyMap<string, number>,
): boolean {
  return incoming.some(
    (message) => message.version < (versions.get(message.id) ?? 0),
  );
}

/** Keep the one open editor synchronized even after its row leaves the bounded live window. */
export function updateActionMessage(
  previous: Message | null,
  incoming: Message[],
): Message | null {
  if (!previous) return previous;
  return incoming.reduce(
    (saved, message) =>
      message.id === saved.id && message.version > saved.version
        ? message
        : saved,
    previous,
  );
}

/** Profile refresh is scoped to retained senders, never to an entire workspace directory. */
export function senderProfileBatches(
  messages: Message[],
  pins: Message[],
  action: Message | null,
  batchSize = 100,
): string[][] {
  const ids = [
    ...new Set(
      [...messages, ...pins, ...(action ? [action] : [])].map(
        (message) => message.sender.id,
      ),
    ),
  ];
  const batches: string[][] = [];
  for (let index = 0; index < ids.length; index += batchSize)
    batches.push(ids.slice(index, index + batchSize));
  return batches;
}

/** Apply ordered change pages without replacing newer acknowledgements or unchanged rows. */
export function mergeMessageWindow(
  previous: Message[],
  incoming: Message[],
  limit = 500,
  includeOlder = false,
): Message[] {
  const byId = new Map(previous.map((message) => [message.id, message]));
  const earliest = previous[0]?.timestamp;
  let changed = false;
  let needsSort = false;
  for (const message of incoming) {
    const existing = byId.get(message.id);
    if (existing) {
      if (message.version <= existing.version) continue;
    } else if (
      !includeOlder &&
      (message.deletedAt || (earliest && message.timestamp < earliest))
    )
      continue;
    if (!existing || existing.timestamp !== message.timestamp) needsSort = true;
    byId.set(message.id, message);
    changed = true;
  }
  if (!changed) return previous;
  const next = [...byId.values()];
  return (needsSort ? next.sort(compareMessages) : next).slice(-limit);
}

/** Remember removed pins/tombstones too, so delayed responses cannot resurrect their old versions. */
export function filterMessageVersions(
  incoming: Message[],
  versions: Map<string, number>,
  limit = 2000,
  protectedIds: ReadonlySet<string> = new Set(),
): Message[] {
  const accepted = new Map<string, Message>();
  for (const message of incoming) {
    if (message.version < (versions.get(message.id) ?? 0)) continue;
    versions.delete(message.id);
    versions.set(message.id, message.version);
    accepted.set(message.id, message);
  }
  for (const id of versions.keys()) {
    if (versions.size <= limit) break;
    if (!protectedIds.has(id)) versions.delete(id);
  }
  return [...accepted.values()];
}

/** Pinned entries can originate outside the currently loaded conversation window. */
export function mergePinnedWindow(
  previous: Message[],
  incoming: Message[],
  limit = 500,
): Message[] {
  const byId = new Map(previous.map((message) => [message.id, message]));
  let changed = false;
  let needsSort = false;
  for (const message of incoming) {
    const existing = byId.get(message.id);
    if (existing && message.version <= existing.version) continue;
    if (message.deletedAt || !message.isPinned) {
      changed = byId.delete(message.id) || changed;
      continue;
    }
    if (!existing || existing.timestamp !== message.timestamp) needsSort = true;
    byId.set(message.id, message);
    changed = true;
  }
  if (!changed) return previous;
  const next = [...byId.values()];
  return (needsSort ? next.sort(compareMessages) : next).slice(-limit);
}

/** Archived pages accept changes only to displayed IDs; unseen arrivals remain unread. */
export function mergeArchivedWindow(
  previous: Message[],
  incoming: Message[],
  pinned = false,
): Message[] {
  const retained = new Set(previous.map((message) => message.id));
  const updates = incoming.filter((message) => retained.has(message.id));
  return pinned
    ? mergePinnedWindow(previous, updates, 100)
    : mergeMessageWindow(previous, updates, 100, true);
}

/** Replace a page without downgrading newer retained acknowledgements. */
export function replaceMessagePage(
  previous: Message[],
  incoming: Message[],
  pinned = false,
): Message[] {
  const retained = new Map(previous.map((message) => [message.id, message]));
  const rows = incoming
    .map((message) => {
      const known = retained.get(message.id);
      return known && known.version > message.version ? known : message;
    })
    .filter((message) => !pinned || (message.isPinned && !message.deletedAt));
  return rows.sort(compareMessages).slice(-100);
}

/** User-profile refreshes update retained older messages without changing message revisions. */
export function updateMessageProfiles(
  messages: Message[],
  users: Map<string, User>,
): Message[] {
  let changed = false;
  const next = messages.map((message) => {
    const profile = users.get(message.sender.id);
    if (!profile) return message;
    const fields = [
      "name",
      "handle",
      "monogram",
      "status",
      "statusText",
      "avatarColor",
    ] as const;
    if (fields.every((field) => profile[field] === message.sender[field]))
      return message;
    changed = true;
    return {
      ...message,
      sender: {
        ...message.sender,
        ...Object.fromEntries(fields.map((field) => [field, profile[field]])),
      },
    };
  });
  return changed ? next : messages;
}

/** Keep stable profile objects for unchanged users during periodic metadata refreshes. */
export function mergeTeamProfiles(previous: User[], incoming: User[]): User[] {
  const byId = new Map(previous.map((user) => [user.id, user]));
  const fields = [
    "id",
    "name",
    "handle",
    "monogram",
    "role",
    "status",
    "statusText",
    "avatarColor",
  ] as const;
  const next = incoming.map((user) => {
    const existing = byId.get(user.id);
    return existing && fields.every((field) => existing[field] === user[field])
      ? existing
      : user;
  });
  return previous.length === next.length &&
    next.every((user, index) => user === previous[index])
    ? previous
    : next;
}
