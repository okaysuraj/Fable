export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Bounded network lifetime; failures always reject rather than inventing data. */
export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15_000,
  responseType: "json" | "blob" = "json",
): Promise<T> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (init.signal?.aborted) controller.abort();
  else init.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (response.status === 204) return undefined as T;
    if (response.ok && responseType === "blob")
      return (await response.blob()) as T;
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : `Request failed (${response.status}).`;
      throw new ApiError(error, response.status);
    }
    if (payload === null)
      throw new ApiError(
        "The server returned an invalid response.",
        response.status,
      );
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (init.signal?.aborted) throw error;
    if (controller.signal.aborted)
      throw new ApiError("The request timed out. Please try again.", 0);
    throw new ApiError(
      "Unable to reach Fable. Check your connection and try again.",
      0,
    );
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", onAbort);
  }
}
