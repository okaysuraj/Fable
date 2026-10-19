import { getToken } from "./firebase";

/** Authenticated HTTP transport: workspace scope, token refresh, cancellation and deadlines. */
const API_BASE = import.meta.env.VITE_API_URL || "/api";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const externalSignal = options.signal;
  const cancel = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener("abort", cancel, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const token = await getToken();
    const workspaceResource =
      /^\/workspace(?:\/[^/?]+)?(?:\?|$)/.test(path) &&
      (options.method || "GET") === "GET" &&
      !path.startsWith("/workspace/audit") &&
      !path.startsWith("/workspace/invitations");
    // Workspace discovery must work even when a saved workspace was revoked.
    const workspaceScoped = !path.startsWith("/auth/") && !workspaceResource;
    const workspaceId = workspaceScoped
      ? localStorage.getItem("fable_workspace")
      : null;
    const send = (identityToken: string | undefined) => {
      const headers = new Headers(options.headers);
      headers.set("Content-Type", "application/json");
      if (identityToken)
        headers.set("Authorization", `Bearer ${identityToken}`);
      if (workspaceId) headers.set("X-Workspace-Id", workspaceId);
      return fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
    };
    let res = await send(token);
    if (res.status === 401 && token) {
      // A rejected identity gets one refresh; other failures are never retried here.
      res = await send(await getToken(true));
    }
    if (res.status === 204) return undefined as T;
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof body.error === "string"
          ? body.error
          : `Request failed (${res.status})`;
      throw new ApiError(message, res.status);
    }
    if (body === null)
      throw new Error("The server returned an invalid response.");
    return body as T;
  } catch (error) {
    if (controller.signal.aborted && !externalSignal?.aborted)
      throw new Error("The request timed out. Please retry.");
    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", cancel);
  }
}
