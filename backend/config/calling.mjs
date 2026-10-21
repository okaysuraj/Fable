import { isIP } from "node:net";

function port(value, fallback, label) {
  const number = Number(value || fallback);
  if (!Number.isInteger(number) || number < 1024 || number > 65535)
    throw new Error(
      `${label} must be an unprivileged port between 1024 and 65535.`,
    );
  return number;
}

export function callingEnvironment(env = process.env) {
  try {
    if (!Array.isArray(JSON.parse(env.WEBRTC_ICE_SERVERS || "[]")))
      throw new Error();
  } catch {
    throw new Error("WEBRTC_ICE_SERVERS must be a valid JSON array.");
  }
  const enabled = env.SFU_ENABLED === "true";
  const address = env.SFU_ANNOUNCED_ADDRESS?.trim();
  const listenIp = env.SFU_LISTEN_IP?.trim() || "0.0.0.0";
  const minimum = port(env.SFU_MIN_PORT, 40000, "SFU_MIN_PORT");
  const maximum = port(env.SFU_MAX_PORT, 40100, "SFU_MAX_PORT");
  if (minimum > maximum || maximum - minimum > 2048)
    throw new Error("Use an ordered SFU port range of at most 2049 ports.");
  if (!isIP(listenIp)) throw new Error("SFU_LISTEN_IP must be an IP address.");
  if (enabled && (!address || !isIP(address)))
    throw new Error(
      "SFU_ANNOUNCED_ADDRESS must be the IP reachable by the phones.",
    );
  if (enabled && maximum - minimum < 47)
    throw new Error(
      "Reserve at least 48 SFU ports for the supported group size.",
    );
  if (
    enabled &&
    env.NODE_ENV === "production" &&
    env.SFU_SINGLE_PROCESS !== "true"
  )
    throw new Error(
      "SFU_SINGLE_PROCESS=true is required for the media-owning API process.",
    );
  const policy = env.CALL_ICE_POLICY?.trim() || "all";
  if (!["all", "relay"].includes(policy))
    throw new Error("CALL_ICE_POLICY must be all or relay.");
  return {
    sfu: { enabled, address, listenIp, minimum, maximum },
    icePolicy: policy,
  };
}
