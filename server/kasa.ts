import { createSocket } from "dgram";
import { connect } from "net";
import { networkInterfaces } from "os";
import type { KasaDevice, KasaLockedDevice, KasaProtocol, KasaStateChange } from "../src/types/kasa";
import {
  DISCOVERY_V2_PORT,
  DISCOVERY_V2_QUERY,
  GET_SYSINFO,
  KASA_PORT,
  assertKasaOk,
  buildStateCommands,
  decrypt,
  encrypt,
  frame,
  parseDiscoveryV2Reply,
  parseSysinfo,
  unframe,
  type KasaEncryptedDeviceInfo,
} from "../src/utils/kasaProtocol";
import { compareIPv4, ipInSubnet, localAddressInSubnet, subnetBroadcast } from "../src/utils/scanConfig";
import { sendKlapCommand, type KasaCredentials } from "./klap";

export type { KasaCredentials };

const DISCOVERY_WINDOW_MS = 3000;
// UDP is lossy, so the broadcast is repeated a few times inside the window.
const DISCOVERY_SEND_AT_MS = [0, 500, 1000];
const TCP_TIMEOUT_MS = 4000;
const LIMITED_BROADCAST = "255.255.255.255";
const DEFAULT_KLAP_PORT = 80;
const MISSING_CREDENTIALS =
  "Uses TP-Link's encrypted protocol (KLAP). Add KASA_USERNAME and KASA_PASSWORD to .env to read and control it.";

// HTTP port each KLAP device reported during discovery.
const klapPorts = new Map<string, number>();

export interface KasaBroadcastResult {
  devices: KasaDevice[];
  locked: KasaLockedDevice[];
  /** Subnets this machine has no adapter on; a broadcast cannot reach them. */
  skippedSubnets: string[];
}

interface BroadcastReplies {
  legacy: KasaDevice[];
  encrypted: KasaEncryptedDeviceInfo[];
}

/** Sends one JSON command to a legacy Kasa device over TCP 9999 and returns its decoded reply. */
export function sendLegacyCommand(ip: string, command: object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: ip, port: KASA_PORT });
    let buffer = new Uint8Array(0);
    let settled = false;

    const finish = (error: Error | null, value?: unknown) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(value);
    };

    socket.setTimeout(TCP_TIMEOUT_MS, () =>
      finish(new Error(`Kasa device ${ip} did not answer within ${TCP_TIMEOUT_MS / 1000}s.`)),
    );
    socket.on("connect", () => socket.write(frame(encrypt(JSON.stringify(command)))));
    socket.on("data", (chunk) => {
      const next = new Uint8Array(buffer.length + chunk.length);
      next.set(buffer);
      next.set(chunk, buffer.length);
      buffer = next;

      const payload = unframe(buffer);
      if (!payload) return;
      try {
        finish(null, JSON.parse(decrypt(payload)));
      } catch {
        finish(new Error(`Kasa device ${ip} sent an invalid reply.`));
      }
    });
    socket.on("error", (err) => finish(new Error(`Kasa device ${ip}: ${err.message}`)));
    socket.on("close", () => finish(new Error(`Kasa device ${ip} closed the connection without replying.`)));
  });
}

function sendCommand(
  ip: string,
  protocol: KasaProtocol,
  credentials: KasaCredentials | null,
  command: object,
): Promise<unknown> {
  if (protocol === "legacy") return sendLegacyCommand(ip, command);
  if (!credentials) return Promise.reject(new Error(MISSING_CREDENTIALS));
  return sendKlapCommand(ip, klapPorts.get(ip) ?? DEFAULT_KLAP_PORT, credentials, command);
}

export async function getKasaDevice(
  ip: string,
  protocol: KasaProtocol,
  credentials: KasaCredentials | null,
): Promise<KasaDevice> {
  return parseSysinfo(ip, await sendCommand(ip, protocol, credentials, GET_SYSINFO), new Date(), protocol);
}

/**
 * Broadcasts discovery on every subnet this machine has an adapter on. Legacy
 * switches answer with their full state; KLAP switches only identify
 * themselves and are then read with the account credentials, if configured.
 */
export async function discoverKasaDevices(
  subnets: string[],
  credentials: KasaCredentials | null,
): Promise<KasaBroadcastResult> {
  const addresses = Object.values(networkInterfaces()).flatMap((list) => list ?? []);
  const skippedSubnets: string[] = [];
  const runs: Promise<BroadcastReplies>[] = [];

  for (const subnet of subnets) {
    const localAddress = localAddressInSubnet(addresses, subnet);
    if (localAddress) runs.push(broadcastFrom(localAddress, subnet));
    else skippedSubnets.push(subnet);
  }

  const legacy = new Map<string, KasaDevice>();
  const encrypted = new Map<string, KasaEncryptedDeviceInfo>();
  for (const replies of await Promise.all(runs)) {
    for (const device of replies.legacy) legacy.set(device.ip, device);
    for (const info of replies.encrypted) encrypted.set(info.ip, info);
  }

  const devices = [...legacy.values()];
  const locked: KasaLockedDevice[] = [];

  await Promise.all(
    [...encrypted.values()]
      .filter((info) => !legacy.has(info.ip))
      .map(async (info) => {
        const lock = (reason: string) => {
          locked.push({ ip: info.ip, model: info.model, mac: info.mac, reason });
        };
        if (info.encryptType !== "KLAP") return lock(`Uses an unsupported encryption (${info.encryptType}).`);
        if (!credentials) return lock(MISSING_CREDENTIALS);

        klapPorts.set(info.ip, info.httpPort);
        try {
          devices.push(await getKasaDevice(info.ip, "klap", credentials));
        } catch (err) {
          lock(err instanceof Error ? err.message : String(err));
        }
      }),
  );

  locked.sort((a, b) => compareIPv4(a.ip, b.ip));
  return { devices, locked, skippedSubnets };
}

/**
 * On Windows with several adapters (VPN, Wi-Fi), only a limited broadcast sent
 * from a socket bound to the adapter's own address gets replies: an unbound
 * socket leaves through another adapter, and the subnet's directed broadcast
 * is not answered. The directed broadcast is still sent for other systems.
 */
function broadcastFrom(localAddress: string, subnet: string): Promise<BroadcastReplies> {
  return new Promise((resolve, reject) => {
    const socket = createSocket({ type: "udp4", reuseAddr: true });
    const legacy = new Map<string, KasaDevice>();
    const encrypted = new Map<string, KasaEncryptedDeviceInfo>();
    const legacyQuery = encrypt(JSON.stringify(GET_SYSINFO));
    const targets = [LIMITED_BROADCAST, subnetBroadcast(subnet)];
    let closed = false;

    const close = () => {
      if (closed) return;
      closed = true;
      socket.close();
    };

    socket.on("message", (message, remote) => {
      if (!ipInSubnet(remote.address, subnet)) return;
      try {
        if (remote.port === KASA_PORT) {
          legacy.set(remote.address, parseSysinfo(remote.address, JSON.parse(decrypt(message)), new Date(), "legacy"));
        } else if (remote.port === DISCOVERY_V2_PORT) {
          encrypted.set(remote.address, parseDiscoveryV2Reply(remote.address, message));
        }
      } catch {
        // Not a supported Kasa switch (bulb, power strip, camera, or an unrelated reply).
      }
    });
    socket.on("error", (err) => {
      close();
      reject(err);
    });

    socket.bind(0, localAddress, () => {
      socket.setBroadcast(true);
      for (const delay of DISCOVERY_SEND_AT_MS) {
        setTimeout(() => {
          if (closed) return;
          for (const target of targets) {
            socket.send(legacyQuery, KASA_PORT, target);
            socket.send(DISCOVERY_V2_QUERY, DISCOVERY_V2_PORT, target);
          }
        }, delay);
      }
      setTimeout(() => {
        close();
        resolve({ legacy: [...legacy.values()], encrypted: [...encrypted.values()] });
      }, DISCOVERY_WINDOW_MS);
    });
  });
}

/** Applies a state change and returns the device as it reports itself afterwards. */
export async function setKasaState(
  ip: string,
  protocol: KasaProtocol,
  credentials: KasaCredentials | null,
  change: KasaStateChange,
): Promise<KasaDevice> {
  for (const command of buildStateCommands(change)) {
    assertKasaOk(await sendCommand(ip, protocol, credentials, command));
  }
  return getKasaDevice(ip, protocol, credentials);
}
