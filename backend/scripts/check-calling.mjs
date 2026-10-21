/** Operational readiness: real TURN allocation and API health; no application records are created. */
import "dotenv/config";
import { createSocket } from "node:dgram";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { connect } from "node:tls";
import { callingEnvironment } from "../config/calling.mjs";

const magic = 0x2112a442;
function attribute(type, value) {
  const output = Buffer.alloc(4 + Math.ceil(value.length / 4) * 4);
  output.writeUInt16BE(type, 0);
  output.writeUInt16BE(value.length, 2);
  value.copy(output, 4);
  return output;
}
function integer(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(value);
  return bytes;
}
function message(type, transaction, attributes, key) {
  const body = Buffer.concat(attributes);
  const header = Buffer.alloc(20);
  header.writeUInt16BE(type);
  header.writeUInt16BE(body.length + (key ? 24 : 0), 2);
  header.writeUInt32BE(magic, 4);
  transaction.copy(header, 8);
  const integrity = key
    ? attribute(
        0x0008,
        createHmac("sha1", key).update(header).update(body).digest(),
      )
    : Buffer.alloc(0);
  return Buffer.concat([header, body, integrity]);
}
function attributes(packet) {
  const values = new Map();
  for (let offset = 20; offset + 4 <= packet.length;) {
    const type = packet.readUInt16BE(offset),
      length = packet.readUInt16BE(offset + 2);
    if (offset + 4 + length > packet.length)
      throw new Error("Malformed TURN response.");
    values.set(type, packet.subarray(offset + 4, offset + 4 + length));
    offset += 4 + Math.ceil(length / 4) * 4;
  }
  return values;
}
function verifyIntegrity(packet, key) {
  for (let offset = 20; offset + 4 <= packet.length;) {
    const type = packet.readUInt16BE(offset),
      length = packet.readUInt16BE(offset + 2);
    if (type === 0x0008 && length === 20 && offset + 24 <= packet.length) {
      const header = Buffer.from(packet.subarray(0, 20));
      header.writeUInt16BE(offset + 24 - 20, 2);
      const expected = createHmac("sha1", key)
        .update(header)
        .update(packet.subarray(20, offset))
        .digest();
      if (timingSafeEqual(expected, packet.subarray(offset + 4, offset + 24)))
        return;
      break;
    }
    offset += 4 + Math.ceil(length / 4) * 4;
  }
  throw new Error("TURN response integrity verification failed.");
}
function endpoint(uri) {
  const match =
    /^(turns?):(\[[^\]]+\]|[^:?]+)(?::(\d+))?(?:\?transport=(udp|tcp))?$/.exec(
      uri,
    );
  if (!match) throw new Error("Invalid TURN endpoint.");
  return {
    tls: match[1] === "turns",
    host: match[2].replace(/^\[|\]$/g, ""),
    port: Number(match[3] || (match[1] === "turns" ? 5349 : 3478)),
    transport: match[4] || "udp",
  };
}
async function allocate(server, secret) {
  const socket = createSocket(server.host.includes(":") ? "udp6" : "udp4");
  const request = (type, values, key) =>
    new Promise((resolve, reject) => {
      const transaction = randomBytes(12);
      const packet = message(type, transaction, values, key);
      let retries = 0;
      const timer = setInterval(() => {
        if (++retries >= 5) {
          cleanup();
          reject(
            new Error(
              "TURN did not respond. Check the relay, advertised IP, UDP ports and host firewall.",
            ),
          );
        } else socket.send(packet, server.port, server.host);
      }, 1000);
      const receive = (result) => {
        if (
          result.length < 20 ||
          result.readUInt32BE(4) !== magic ||
          !result.subarray(8, 20).equals(transaction)
        )
          return;
        cleanup();
        resolve(result);
      };
      const error = () => {
        cleanup();
        reject(new Error("Unable to reach the configured TURN endpoint."));
      };
      function cleanup() {
        clearInterval(timer);
        socket.removeListener("message", receive);
        socket.removeListener("error", error);
      }
      socket.on("message", receive);
      socket.on("error", error);
      socket.send(packet, server.port, server.host, (failure) => {
        if (failure) error();
      });
    });
  try {
    const transport = attribute(0x0019, Buffer.from([17, 0, 0, 0]));
    const challenge = attributes(await request(0x0003, [transport]));
    const realm = challenge.get(0x0014),
      nonce = challenge.get(0x0015);
    if (!realm || !nonce)
      throw new Error(
        "The relay did not require the expected shared-secret authentication.",
      );
    const username = `${Math.floor(Date.now() / 1000) + 120}:fable-operations-${randomBytes(8).toString("hex")}`;
    const password = createHmac("sha1", secret)
      .update(username)
      .digest("base64");
    const key = createHash("md5")
      .update(`${username}:${realm.toString()}:${password}`)
      .digest();
    const auth = [
      attribute(0x0006, Buffer.from(username)),
      attribute(0x0014, realm),
      attribute(0x0015, nonce),
    ];
    const response = await request(
      0x0003,
      [...auth, transport, attribute(0x000d, integer(60))],
      key,
    );
    if (
      response.readUInt16BE(0) !== 0x0103 ||
      !attributes(response).has(0x0016)
    )
      throw new Error(
        "TURN allocation was rejected. Check the API and relay shared secrets match.",
      );
    verifyIntegrity(response, key);
    const released = await request(
      0x0004,
      [...auth, attribute(0x000d, integer(0))],
      key,
    );
    verifyIntegrity(released, key);
    if (released.readUInt16BE(0) !== 0x0104)
      throw new Error(
        "TURN allocation succeeded but its release failed; it will expire within 60 seconds.",
      );
  } finally {
    socket.close();
  }
}
async function tlsReady(server) {
  await new Promise((resolve, reject) => {
    const socket = connect({
      host: server.host,
      port: server.port,
      servername: server.host,
      rejectUnauthorized: true,
    });
    socket.setTimeout(10000);
    socket.once("secureConnect", () => {
      socket.end();
      resolve();
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("TURN TLS connection timed out."));
    });
    socket.once("error", () =>
      reject(
        new Error(
          "TURN TLS certificate or connectivity could not be verified.",
        ),
      ),
    );
  });
}
try {
  const calling = callingEnvironment();
  const servers = (process.env.TURN_URLS || "")
    .split(",")
    .filter(Boolean)
    .map(endpoint);
  const server = servers.find(
    (value) => !value.tls && value.transport === "udp",
  );
  if (!server || !process.env.TURN_SHARED_SECRET)
    throw new Error(
      "Configure owned TURN UDP access with npm run calls:setup first.",
    );
  await allocate(server, process.env.TURN_SHARED_SECRET);
  const secure = servers.find((value) => value.tls);
  if (secure) await tlsReady(secure);
  console.log(
    JSON.stringify({
      turnAllocation: "authenticated",
      allocationReleased: true,
      tls: secure ? "verified" : "LAN UDP/TCP",
    }),
  );
  if (!process.argv.includes("--relay-only")) {
    const response = await fetch(
      `http://127.0.0.1:${process.env.PORT || 5000}/api/health/ready`,
      { signal: AbortSignal.timeout(15000) },
    );
    const health = await response.json();
    if (!response.ok || !calling.sfu.enabled || health.calling !== "ready")
      throw new Error(
        "Relay works; restart the API with SFU_ENABLED=true and verify its readiness.",
      );
    console.log(
      JSON.stringify({
        api: "ready",
        database: health.database,
        realtime: health.realtime,
        groupMedia: health.calling,
        icePolicy: calling.icePolicy,
        deviceCalling: "requires two-phone verification",
      }),
    );
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Calling readiness failed.",
  );
  process.exitCode = 1;
}
