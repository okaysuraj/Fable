import { createHmac } from "node:crypto";
import { z } from "zod";
import { parse } from "./http.js";
import { config } from "./config.js";

const legacy = parse(
  z
    .array(
      z
        .object({
          urls: z.union([z.string(), z.array(z.string()).min(1).max(4)]),
          username: z.string().optional(),
          credential: z.string().optional(),
        })
        .strict(),
    )
    .max(8),
  JSON.parse(process.env.WEBRTC_ICE_SERVERS || "[]"),
);
const urls = (process.env.TURN_URLS || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
for (const url of [
  ...legacy.flatMap((server) => [server.urls].flat()),
  ...urls,
])
  if (!/^(stun|stuns|turn|turns):[^\s]+$/.test(url))
    throw new Error("Invalid STUN/TURN URL");
if (
  urls.length &&
  (!process.env.TURN_SHARED_SECRET ||
    process.env.TURN_SHARED_SECRET.length < 32)
)
  throw new Error("TURN_SHARED_SECRET must contain at least 32 characters");
const relayConfigured =
  urls.length > 0 ||
  legacy.some((entry) =>
    [entry.urls].flat().some((url) => /^turns?:/.test(url)),
  );
if (config.calling.icePolicy === "relay" && !relayConfigured)
  throw new Error("CALL_ICE_POLICY=relay requires a configured TURN server");
export function callIce(userId: string) {
  if (!urls.length)
    return {
      iceServers: legacy,
      relayConfigured,
      iceTransportPolicy: config.calling.icePolicy,
    };
  // Expires after the maximum call lifetime plus reconnect margin. The shared secret stays server-side.
  const expiresAt = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
  const username = `${expiresAt}:${userId}`;
  const credential = createHmac("sha1", process.env.TURN_SHARED_SECRET!)
    .update(username)
    .digest("base64");
  return {
    iceServers: [...legacy, { urls, username, credential }],
    expiresAt,
    relayConfigured: true,
    iceTransportPolicy: config.calling.icePolicy,
  };
}
