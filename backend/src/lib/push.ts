/** Direct APNs / FCM transport. Provider acceptance never becomes a read or device-delivery receipt. */
import { connect } from "node:http2";
import { createPrivateKey, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { getMessaging } from "firebase-admin/messaging";
import { getFirebaseAuth } from "./firebase.js";

export class PushError extends Error {
  constructor(
    public code: string,
    public permanent = false,
    public invalidToken = false,
  ) {
    super(code);
  }
}
type Payload = {
  type: "message" | "call";
  title: string;
  body: string;
  data: Record<string, string>;
  expiration: number;
  id: string;
};
let appleJwt: { value: string; expiresAt: number } | undefined;
async function appleToken() {
  if (appleJwt && appleJwt.expiresAt > Date.now()) return appleJwt.value;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const pem =
    process.env.APNS_KEY_P8?.replace(/\\n/g, "\n") ||
    (process.env.APNS_KEY_PATH
      ? await readFile(process.env.APNS_KEY_PATH, "utf8")
      : undefined);
  if (!keyId || !teamId || !pem) throw new PushError("apns/not-configured");
  const header = Buffer.from(
    JSON.stringify({ alg: "ES256", kid: keyId }),
  ).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }),
  ).toString("base64url");
  const unsigned = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(unsigned), {
    key: createPrivateKey(pem),
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  appleJwt = {
    value: `${unsigned}.${signature}`,
    expiresAt: Date.now() + 45 * 60000,
  };
  return appleJwt.value;
}
export async function sendPush(
  device: {
    provider: string;
    token: string;
    voipToken: string | null;
    sandbox: boolean;
  },
  payload: Payload,
) {
  if (device.provider === "fcm") {
    getFirebaseAuth(); // Initialize the same configured Admin application.
    try {
      await getMessaging().send({
        token: device.token,
        data: payload.data,
        ...(payload.type === "message"
          ? { notification: { title: payload.title, body: payload.body } }
          : {}),
        android: {
          priority: "high",
          ttl: Math.max(0, payload.expiration * 1000 - Date.now()),
          ...(payload.type === "message"
            ? {
                notification: {
                  channelId: "messages",
                  tag: payload.id,
                  sound: "default",
                },
              }
            : {}),
        },
      });
      return;
    } catch (error) {
      const code = (error as { code?: string }).code || "messaging/unavailable";
      const invalid = [
        "messaging/registration-token-not-registered",
        "messaging/invalid-registration-token",
      ].includes(code);
      throw new PushError(
        code,
        invalid || code === "messaging/invalid-argument",
        invalid,
      );
    }
  }
  const topic = process.env.APNS_BUNDLE_ID;
  if (!topic) throw new PushError("apns/not-configured");
  const voip = payload.type === "call";
  if (voip && !device.voipToken)
    throw new PushError("apns/voip-token-missing", true);
  const authorization = await appleToken();
  const body = JSON.stringify({
    aps: voip
      ? { "content-available": 1 }
      : {
          alert: { title: payload.title, body: payload.body },
          sound: "default",
          "thread-id": payload.data.channelId,
        },
    ...payload.data,
  });
  await new Promise<void>((resolve, reject) => {
    const connection = connect(
      device.sandbox
        ? "https://api.sandbox.push.apple.com"
        : "https://api.push.apple.com",
    );
    const timer = setTimeout(() => {
      connection.destroy();
      reject(new PushError("apns/timeout"));
    }, 12000);
    connection.on("error", () => {
      clearTimeout(timer);
      connection.destroy();
      reject(new PushError("apns/connection-error"));
    });
    const request = connection.request({
      ":method": "POST",
      ":path": `/3/device/${voip ? device.voipToken : device.token}`,
      authorization: `bearer ${authorization}`,
      "apns-topic": voip ? `${topic}.voip` : topic,
      "apns-push-type": voip ? "voip" : "alert",
      "apns-priority": "10",
      "apns-expiration": String(payload.expiration),
      "apns-id": payload.id,
      "content-type": "application/json",
    });
    let status = 0;
    let response = "";
    request.on("response", (headers) => {
      status = Number(headers[":status"]);
    });
    request.on("data", (data: Buffer) => {
      if (response.length < 4096) response += data.toString();
    });
    request.on("error", () => {
      clearTimeout(timer);
      connection.destroy();
      reject(new PushError("apns/request-error"));
    });
    request.on("end", () => {
      clearTimeout(timer);
      connection.close();
      if (status === 200) {
        resolve();
        return;
      }
      let reason = "rejected";
      try {
        const parsed = JSON.parse(response);
        if (
          typeof parsed.reason === "string" &&
          /^[A-Za-z]+$/.test(parsed.reason)
        )
          reason = parsed.reason;
      } catch {
        /* Keep the bounded provider status only. */
      }
      const invalid = [
        "BadDeviceToken",
        "Unregistered",
        "DeviceTokenNotForTopic",
      ].includes(reason);
      reject(
        new PushError(
          `apns/${reason}`,
          invalid ||
            (status >= 400 && status < 500 && ![403, 429].includes(status)),
          invalid,
        ),
      );
    });
    request.end(body);
  });
}
