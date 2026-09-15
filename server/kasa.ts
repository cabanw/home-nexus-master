import { createSocket } from "dgram";
import { connect } from "net";
import { networkInterfaces } from "os";
import type { KasaDevice, KasaStateChange } from "../src/types/kasa";
import {
  GET_SYSINFO,
  KASA_PORT,
  assertKasaOk,
  buildStateCommands,
  decrypt,
  encrypt,
  frame,
  parseSysinfo,
  unframe,
} from "../src/utils/kasaProtocol";
import { ipInSubnet, localAddressInSubnet, subnetBroadcast } from "../src/utils/scanConfig";

const DISCOVERY_WINDOW_MS = 3000;
// UDP is lossy, so the broadcast is repeated a few times inside the window.
const DISCOVERY_SEND_AT_MS = [0, 500, 1000];
const TCP_TIMEOUT_MS = 4000;
const LIMITED_BROADCAST = "255.255.255.255";

export interface KasaBroadcastResult {
  devices: KasaDevice[];
  /** Subnets this machine has no adapter on; a broadcast cannot reach them. */
  skippedSubnets: string[];
}

/** Sends one JSON command to a Kasa device over TCP and returns its decoded reply. */
export function sendKasaCommand(ip: string, command: object): Promise<unknown> {
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

export async function getKasaDevice(ip: string): Promise<KasaDevice> {
  return parseSysinfo(ip, await sendKasaCommand(ip, GET_SYSINFO), new Date());
}

/**
 * Broadcasts get_sysinfo on every subnet this machine has an adapter on and
 * returns the supported switches that answer.
 */
export async function discoverKasaDevices(subnets: string[]): Promise<KasaBroadcastResult> {
  const addresses = Object.values(networkInterfaces()).flatMap((list) => list ?? []);
  const skippedSubnets: string[] = [];
  const runs: Promise<KasaDevice[]>[] = [];

  for (const subnet of subnets) {
    const localAddress = localAddressInSubnet(addresses, subnet);
    if (localAddress) runs.push(broadcastFrom(localAddress, subnet));
    else skippedSubnets.push(subnet);
  }

  const found = new Map<string, KasaDevice>();
  for (const devices of await Promise.all(runs)) {
    for (const device of devices) found.set(device.ip, device);
  }
  return { devices: [...found.values()], skippedSubnets };
}

/**
 * On Windows with several adapters (VPN, Wi-Fi), only a limited broadcast sent
 * from a socket bound to the adapter's own address gets replies: an unbound
 * socket leaves through another adapter, and the subnet's directed broadcast
 * is not answered. The directed broadcast is still sent for other systems.
 */
function broadcastFrom(localAddress: string, subnet: string): Promise<KasaDevice[]> {
  return new Promise((resolve, reject) => {
    const socket = createSocket({ type: "udp4", reuseAddr: true });
    const found = new Map<string, KasaDevice>();
    const payload = encrypt(JSON.stringify(GET_SYSINFO));
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
        found.set(remote.address, parseSysinfo(remote.address, JSON.parse(decrypt(message)), new Date()));
      } catch {
        // Not a supported Kasa switch (bulb, power strip, or an unrelated reply).
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
          for (const target of targets) socket.send(payload, KASA_PORT, target);
        }, delay);
      }
      setTimeout(() => {
        close();
        resolve([...found.values()]);
      }, DISCOVERY_WINDOW_MS);
    });
  });
}

/** Applies a state change and returns the device as it reports itself afterwards. */
export async function setKasaState(ip: string, change: KasaStateChange): Promise<KasaDevice> {
  for (const command of buildStateCommands(change)) {
    assertKasaOk(await sendKasaCommand(ip, command));
  }
  return getKasaDevice(ip);
}
