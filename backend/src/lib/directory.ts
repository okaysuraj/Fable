/** Directory bounds and response metadata are shared across growing, authorized collections. */
import { z } from "zod";

// IDs remain opaque. Each route validates its cursor inside the caller's actual scope.
export const directoryQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    after: z.string().min(1).max(128).optional(),
    q: z.string().trim().max(120).default(""),
  })
  .strict();

export function directoryPage<T>(
  rows: T[],
  limit: number,
  total: number,
  id: (row: T) => string,
) {
  const data = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  return {
    data,
    total,
    hasMore,
    nextCursor: hasMore ? id(data[data.length - 1]) : null,
  };
}
