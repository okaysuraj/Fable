/** Configure owned calling infrastructure. Generated credentials never enter source control. */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { isIPv4 } from "node:net";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { parse } from "dotenv";
import { databaseEnvironment } from "../config/database.mjs";
import { callingEnvironment } from "../config/calling.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const generated = path.join(root, "ops", "generated");
const image =
  "coturn/coturn:4.18.0-r0@sha256:bbefd3e1fdfdc0d58770fe01b581fd8b00d9f3a5580d00acb77cf719a6bc78e3";
const container = "fable-turn-local";
const label = "com.fable.service";
const [command = "help", ...args] = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith("--"))
    throw new Error(`Supply a value for --${name}.`);
  return args[index + 1];
}
async function execute(program, parameters, { optional = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, parameters, {
      cwd: root,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (data) => {
      output += data;
    });
    child.stderr.resume();
    child.on("error", () =>
      reject(
        new Error(
          `${program} is unavailable. Install it before running this command.`,
        ),
      ),
    );
    child.on("close", (code) =>
      code === 0 || optional
        ? resolve(output.trim())
        : reject(
            new Error(
              `${program} failed (${code}). Check that its service is running and the required ports are free.`,
            ),
          ),
    );
  });
}
async function write(file, value) {
  const destination = path.resolve(file);
  if (!destination.startsWith(generated + path.sep))
    throw new Error("Invalid generated configuration path.");
  await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await fs.writeFile(destination, value, { mode: 0o600 });
  await fs.chmod(destination, 0o600);
}
function envValue(value) {
  const text = String(value);
  const quote = ["'", "`", '"'].find((candidate) => !text.includes(candidate));
  if (!quote || text.includes("\0"))
    throw new Error(
      "A configuration value needs direct secret injection instead of dotenv quoting.",
    );
  return `${quote}${text}${quote}`;
}
function dotenv(values) {
  const result =
    Object.entries(values)
      .map(([key, value]) => `${key}=${envValue(value)}`)
      .join("\n") + "\n";
  const parsed = parse(result);
  if (
    Object.entries(values).some(([key, value]) => parsed[key] !== String(value))
  )
    throw new Error(
      "Environment serialization did not preserve a configuration value.",
    );
  return result;
}
async function saveActive(values) {
  const file = path.join(root, ".env");
  let content = await fs.readFile(file, "utf8");
  const backups = path.join(root, "data", "backups");
  await fs.mkdir(backups, { recursive: true, mode: 0o700 });
  await fs.writeFile(
    path.join(backups, `before-calling-${Date.now()}.env`),
    content,
    { flag: "wx", mode: 0o600 },
  );
  for (const [key, value] of Object.entries(values)) {
    const regex = new RegExp(`^${key}=[^\\r\\n]*`, "m");
    const line = `${key}=${envValue(value)}`;
    content = regex.test(content)
      ? content.replace(regex, () => line)
      : content.trimEnd() + "\n" + line + "\n";
  }
  const parsed = parse(content);
  if (
    Object.entries(values).some(([key, value]) => parsed[key] !== String(value))
  )
    throw new Error(
      "Environment update did not preserve a configuration value.",
    );
  await fs.writeFile(file, content, { mode: 0o600 });
}
function localHost() {
  const selected = option("host");
  const addresses = [
    ...new Set(
      Object.entries(os.networkInterfaces())
        .filter(
          ([name]) => !/loopback|docker|vethernet|virtual|wsl/i.test(name),
        )
        .flatMap(([, interfaces]) => interfaces || [])
        .filter(
          (entry) =>
            entry.family === "IPv4" &&
            !entry.internal &&
            !entry.address.startsWith("169.254."),
        )
        .map((entry) => entry.address),
    ),
  ];
  const host = selected || (addresses.length === 1 ? addresses[0] : undefined);
  if (!host || !isIPv4(host) || !addresses.includes(host))
    throw new Error(
      "Supply --host with this computer's LAN IPv4 address; use the address reachable by your phones.",
    );
  return host;
}
function turnConfig(host, secret, server = false) {
  return (
    [
      "listening-port=3478",
      "min-port=49160",
      "max-port=49260",
      "fingerprint",
      "use-auth-secret",
      `static-auth-secret=${secret}`,
      `realm=${server ? host : "fable.local"}`,
      `server-name=${host}`,
      ...(!server
        ? [`external-ip=${host}`, "no-tls", "no-dtls"]
        : [
            "tls-listening-port=5349",
            "cert=/etc/fable/turn/fullchain.pem",
            "pkey=/etc/fable/turn/privkey.pem",
          ]),
      "no-cli",
      "no-multicast-peers",
      "no-tcp-relay",
      "stale-nonce=600",
      "user-quota=8",
      "total-quota=1000",
      "max-bps=1000000",
      "bps-capacity=100000000",
      "log-file=stdout",
      "simple-log",
      "pidfile=/tmp/turnserver.pid",
      "denied-peer-ip=0.0.0.0-0.255.255.255",
      "denied-peer-ip=127.0.0.0-127.255.255.255",
      "denied-peer-ip=169.254.0.0-169.254.255.255",
      "denied-peer-ip=224.0.0.0-255.255.255.255",
      "denied-peer-ip=::1",
      ...(server
        ? [
            "denied-peer-ip=10.0.0.0-10.255.255.255",
            "denied-peer-ip=172.16.0.0-172.31.255.255",
            "denied-peer-ip=192.168.0.0-192.168.255.255",
            "denied-peer-ip=fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff",
            "denied-peer-ip=fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff",
          ]
        : []),
    ].join("\n") + "\n"
  );
}
async function ownedContainer() {
  const output = await execute("docker", ["container", "inspect", container], {
    optional: true,
  });
  if (!output) return false;
  const value = JSON.parse(output)[0];
  if (!value) return false;
  if (value.Config?.Labels?.[label] !== "turn-local")
    throw new Error(
      "An unrelated container uses the Fable relay name; it will not be changed.",
    );
  return true;
}
async function setup(env) {
  if (env.NODE_ENV !== "development")
    throw new Error("Local relay setup requires NODE_ENV=development.");
  const host = localHost();
  const secret =
    env.TURN_SHARED_SECRET || randomBytes(48).toString("base64url");
  if (!/^[\w-]{32,}$/.test(secret))
    throw new Error(
      "Use a base64url TURN_SHARED_SECRET of at least 32 characters.",
    );
  const updates = {
    WEBRTC_ICE_SERVERS: JSON.stringify([{ urls: `stun:${host}:3478` }]),
    TURN_URLS: `turn:${host}:3478?transport=udp,turn:${host}:3478?transport=tcp`,
    TURN_SHARED_SECRET: secret,
    CALL_ICE_POLICY: "all",
    SFU_ENABLED: "true",
    SFU_SINGLE_PROCESS: "true",
    SFU_ANNOUNCED_ADDRESS: host,
    SFU_LISTEN_IP: "0.0.0.0",
    SFU_MIN_PORT: "40000",
    SFU_MAX_PORT: "40100",
  };
  callingEnvironment({ ...env, ...updates });
  await write(
    path.join(generated, "local", "turnserver.conf"),
    turnConfig(host, secret),
  );
  await write(
    path.join(generated, "local", "settings.json"),
    JSON.stringify({ host, image, mode: "local" }, null, 2),
  );
  await saveActive(updates);
  console.log(
    `Local calls configured for ${host}. Run npm run calls:relay, restart the API, then npm run calls:check.`,
  );
  console.log(
    "Allow inbound TCP/UDP 3478 and 40000-40100, plus UDP 49160-49260, on your private LAN firewall.",
  );
}
async function relay() {
  const directory = path.join(generated, "local");
  const { host } = JSON.parse(
    await fs.readFile(path.join(directory, "settings.json"), "utf8"),
  );
  if (!isIPv4(host)) throw new Error("Run calls:setup first.");
  if (await ownedContainer())
    await execute("docker", ["container", "rm", "--force", container]);
  await execute("docker", [
    "run",
    "--detach",
    "--name",
    container,
    ...(typeof process.getuid === "function"
      ? ["--user", `${process.getuid()}:${process.getgid()}`]
      : []),
    "--label",
    `${label}=turn-local`,
    "--restart",
    "unless-stopped",
    "--health-cmd",
    "turnutils_stunclient -p 3478 127.0.0.1",
    "--health-interval",
    "30s",
    "--health-timeout",
    "10s",
    "--read-only",
    "--tmpfs",
    "/tmp",
    "--cap-drop",
    "ALL",
    "--cap-add",
    "NET_BIND_SERVICE",
    "--security-opt",
    "no-new-privileges:true",
    "--publish",
    `${host}:3478:3478/udp`,
    "--publish",
    `${host}:3478:3478/tcp`,
    "--publish",
    `${host}:49160-49260:49160-49260/udp`,
    "--mount",
    `type=bind,source=${directory},target=/etc/fable,readonly`,
    image,
    "-c",
    "/etc/fable/turnserver.conf",
  ]);
  console.log("Owned local TURN relay started. Run npm run calls:check.");
}
function domain(value, label) {
  if (
    !value ||
    value.length > 253 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value) ||
    /(?:^|\.)(?:example\.(?:com|org|net)|localhost)$/.test(value)
  )
    throw new Error(
      `Supply your real --${label} hostname, without a scheme or path.`,
    );
  return value;
}
async function server(env) {
  const api = domain(option("api-domain"), "api-domain");
  const turn = domain(option("turn-domain"), "turn-domain");
  const ip = option("public-ip");
  if (
    !ip ||
    !isIPv4(ip) ||
    /^(?:0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(
      ip,
    )
  )
    throw new Error(
      "Supply --public-ip with the Linux server's public IPv4 address.",
    );
  if (api === turn) throw new Error("Use separate API and TURN hostnames.");
  const origin = option("web-origin") || `https://${api}`;
  if (new URL(origin).origin !== origin || !origin.startsWith("https://"))
    throw new Error("--web-origin must be an HTTPS origin.");
  const db = databaseEnvironment(env);
  const secret = randomBytes(48).toString("base64url");
  const folder = path.join(generated, "server");
  try {
    await fs.access(path.join(folder, "api.env"));
    throw new Error(
      "A server bundle already exists. Preserve it and choose its credentials before generating another.",
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const values = {
    ...env,
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    PORT: "5000",
    FRONTEND_URL: origin,
    TRUST_PROXY_HOPS: "1",
    DIRECT_DATABASE_URL: db.eventUrl,
    DATABASE_RUNTIME_ROLE: "",
    LOCAL_DATABASE_URL: "",
    LOCAL_DATABASE_CONTAINER: "",
    GOOGLE_APPLICATION_CREDENTIALS: "/etc/fable/firebase-admin.json",
    FIREBASE_CLIENT_EMAIL: "",
    FIREBASE_PRIVATE_KEY: "",
    FIREBASE_SERVICE_ACCOUNT_JSON: "",
    WORKER_EMBEDDED: "false",
    MEDIA_STORAGE_DRIVER: "disk",
    MEDIA_STORAGE_PATH: "/var/lib/fable/media",
    MEDIA_STORAGE_DURABILITY: "single-host",
    TURN_URLS: `turn:${turn}:3478?transport=udp,turn:${turn}:3478?transport=tcp,turns:${turn}:5349?transport=tcp`,
    TURN_SHARED_SECRET: secret,
    WEBRTC_ICE_SERVERS: JSON.stringify([{ urls: `stun:${turn}:3478` }]),
    CALL_ICE_POLICY: "all",
    SFU_ENABLED: "true",
    SFU_SINGLE_PROCESS: "true",
    SFU_ANNOUNCED_ADDRESS: ip,
    SFU_LISTEN_IP: "0.0.0.0",
    SFU_MIN_PORT: "40000",
    SFU_MAX_PORT: "40100",
  };
  delete values.FIREBASE_AUTH_EMULATOR_HOST;
  callingEnvironment(values);
  databaseEnvironment(values);
  const credential = JSON.parse(
    await fs.readFile(
      path.resolve(
        root,
        env.GOOGLE_APPLICATION_CREDENTIALS || "credentials/firebase-admin.json",
      ),
      "utf8",
    ),
  );
  if (
    credential.type !== "service_account" ||
    credential.project_id !== env.FIREBASE_PROJECT_ID
  )
    throw new Error(
      "Configure the matching backend-only Firebase JSON before preparing the server bundle.",
    );
  await write(path.join(folder, "api.env"), dotenv(values));
  await write(
    path.join(folder, "migration.env"),
    dotenv({ ...env, WORKER_EMBEDDED: "false" }),
  );
  await write(
    path.join(folder, "firebase-admin.json"),
    JSON.stringify(credential),
  );
  await write(
    path.join(folder, "turnserver.conf"),
    turnConfig(turn, secret, true) + `external-ip=${ip}\n`,
  );
  await write(
    path.join(folder, "Caddyfile"),
    `${api} {\n\treverse_proxy 127.0.0.1:5000\n}\n\nhttp://${turn} {\n\troot * /var/lib/fable-acme\n\tfile_server\n}\n`,
  );
  const install = await fs.readFile(
    path.join(root, "ops", "selfhost", "install.sh"),
    "utf8",
  );
  await write(
    path.join(folder, "install.sh"),
    install.replaceAll("@TURN_DOMAIN@", turn),
  );
  for (const file of [
    "fable-api.service",
    "fable-worker.service",
    "fable-turn.service",
    "fable-media-backup.service",
    "fable-media-backup.timer",
    "backup-media.sh",
  ])
    await write(
      path.join(folder, file),
      await fs.readFile(path.join(root, "ops", "selfhost", file), "utf8"),
    );
  await write(
    path.join(folder, "mobile.env"),
    `EXPO_PUBLIC_API_URL=https://${api}/api\n`,
  );
  console.log(
    "Private server bundle prepared in backend/ops/generated/server. Keep this directory out of Git and transfer it through SSH.",
  );
  console.log(
    "On Linux, place backend at /opt/fable/backend. Install Node 22+, Caddy, patched coturn 4.9+, certbot, acl and build tools. As your deployment user run npm ci, npm run prisma:generate and npm run build; then sudo bash ops/generated/server/install.sh.",
  );
  console.log(
    "Point both hostnames at the public IP. Allow TCP 80/443/3478/5349, UDP 3478/49160-49260 and TCP/UDP 40000-40100. Preserve your SSH access.",
  );
  console.log(
    "The existing Neon schema is retained. Copy existing private media into /var/lib/fable/media before switching phones to the HTTPS API. Keep off-host media backups.",
  );
}
try {
  if (command === "help") {
    console.log(
      "Local: npm run calls:setup -- [--host LAN_IPV4], then npm run calls:relay and npm run calls:check. Stop only the owned relay with npm run calls:stop.",
    );
    console.log(
      "Linux server: npm run selfhost:prepare -- --api-domain api.YOUR_DOMAIN --turn-domain turn.YOUR_DOMAIN --public-ip YOUR_PUBLIC_IP [--web-origin https://YOUR_LANDING_DOMAIN]. This generates private files; it does not deploy or change your current app environment.",
    );
  } else if (command === "relay") await relay();
  else if (command === "stop") {
    if (await ownedContainer()) await execute("docker", ["stop", container]);
    console.log("Owned local relay stopped.");
  } else {
    const env = parse(await fs.readFile(path.join(root, ".env"), "utf8"));
    if (command === "setup") await setup(env);
    else if (command === "server") await server(env);
    else throw new Error("Unknown command. Run npm run selfhost:help.");
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Calling configuration failed.",
  );
  process.exitCode = 1;
}
