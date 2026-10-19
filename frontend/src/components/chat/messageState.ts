import type { Message } from "../../types/chat";

/** Merge durable changes without downgrading known versions or growing retained pages. */
export function mergeHistory(
  previous: Message[],
  updates: Message[],
  includeNew = true,
) {
  const byId = new Map(previous.map((message) => [message.id, message]));
  const oldest = previous[0]?.timestamp;
  let changed = false;
  for (const message of updates) {
    const old = byId.get(message.id);
    if (old && message.version > old.version) {
      byId.set(message.id, message);
      changed = true;
    } else if (includeNew && !old && (!oldest || message.timestamp >= oldest)) {
      byId.set(message.id, message);
      changed = true;
    }
  }
  if (!changed) return previous;
  return [...byId.values()]
    .sort(
      (left, right) =>
        left.timestamp.localeCompare(right.timestamp) ||
        left.id.localeCompare(right.id),
    )
    .slice(-50);
}
export function mergePins(
  previous: Message[],
  updates: Message[],
  includeNew = true,
) {
  const byId = new Map(previous.map((message) => [message.id, message]));
  let changed = false;
  for (const message of updates) {
    const old = byId.get(message.id);
    if (old && message.version < old.version) continue;
    if (message.isPinned && !message.deletedAt && (old || includeNew)) {
      if (!old || message.version > old.version) {
        byId.set(message.id, message);
        changed = true;
      }
    } else if (old) {
      byId.delete(message.id);
      changed = true;
    }
  }
  return changed
    ? [...byId.values()]
        .sort(
          (left, right) =>
            right.timestamp.localeCompare(left.timestamp) ||
            right.id.localeCompare(left.id),
        )
        .slice(0, 50)
    : previous;
}
