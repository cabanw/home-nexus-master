import type { KasaDevice, KasaStateChange } from "../types/kasa";

/** TP-Link Kasa local protocol: JSON over TCP/UDP port 9999, obfuscated with an XOR autokey cipher. */
export const KASA_PORT = 9999;
const INITIAL_KEY = 171;

export const GET_SYSINFO = { system: { get_sysinfo: {} } };

export function encrypt(text: string): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  let key = INITIAL_KEY;
  for (let i = 0; i < bytes.length; i++) {
    key ^= bytes[i];
    bytes[i] = key;
  }
  return bytes;
}

export function decrypt(bytes: Uint8Array): string {
  const out = new Uint8Array(bytes.length);
  let key = INITIAL_KEY;
  for (let i = 0; i < bytes.length; i++) {
    out[i] = key ^ bytes[i];
    key = bytes[i];
  }
  return new TextDecoder().decode(out);
}

/** TCP messages carry a 4-byte big-endian length prefix; UDP messages do not. */
export function frame(payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + payload.length);
  new DataView(out.buffer).setUint32(0, payload.length);
  out.set(payload, 4);
  return out;
}

/** Returns the payload once the whole framed message has arrived, otherwise null. */
export function unframe(buffer: Uint8Array): Uint8Array | null {
  if (buffer.length < 4) return null;
  const length = new DataView(buffer.buffer, buffer.byteOffset, 4).getUint32(0);
  if (buffer.length < 4 + length) return null;
  return buffer.subarray(4, 4 + length);
}

interface RawSysinfo {
  alias?: string;
  model?: string;
  dev_name?: string;
  mac?: string;
  relay_state?: number;
  brightness?: number;
  sw_ver?: string;
  mic_type?: string;
  type?: string;
  children?: unknown[];
}

/**
 * Builds a KasaDevice from a get_sysinfo reply. Only the fields the app shows
 * are copied: the raw reply also contains data such as the home's latitude and
 * longitude, which must never be forwarded to the browser.
 */
export function parseSysinfo(ip: string, response: unknown, seenAt: Date): KasaDevice {
  const sysinfo = (response as { system?: { get_sysinfo?: RawSysinfo } } | null)?.system?.get_sysinfo;
  if (!sysinfo || typeof sysinfo !== "object") {
    throw new Error(`No sysinfo in reply from ${ip}.`);
  }

  const type = sysinfo.mic_type ?? sysinfo.type;
  if (type !== "IOT.SMARTPLUGSWITCH" || Array.isArray(sysinfo.children) || typeof sysinfo.relay_state !== "number") {
    throw new Error(`Unsupported Kasa device at ${ip} (${sysinfo.model ?? type ?? "unknown model"}).`);
  }

  return {
    id: sysinfo.mac ?? ip,
    ip,
    alias: sysinfo.alias?.trim() || sysinfo.model || ip,
    model: sysinfo.model ?? "unknown",
    deviceName: sysinfo.dev_name ?? "",
    mac: sysinfo.mac ?? "N/A",
    on: sysinfo.relay_state === 1,
    brightness: typeof sysinfo.brightness === "number" ? sysinfo.brightness : null,
    firmware: sysinfo.sw_ver ?? "",
    online: true,
    lastSeen: seenAt.toISOString(),
  };
}

/** Validates a state change request body from the browser. */
export function validateStateChange(body: unknown): KasaStateChange {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Send a JSON object with on and/or brightness.");
  }

  const { on, brightness, ...rest } = body as Record<string, unknown>;
  const unknownFields = Object.keys(rest);
  if (unknownFields.length > 0) throw new Error(`Unknown field: ${unknownFields.join(", ")}.`);
  if (on === undefined && brightness === undefined) throw new Error("Send on and/or brightness.");
  if (on !== undefined && typeof on !== "boolean") throw new Error("on must be true or false.");
  if (brightness !== undefined && !(Number.isInteger(brightness) && Number(brightness) >= 1 && Number(brightness) <= 100)) {
    throw new Error("brightness must be a whole number from 1 to 100.");
  }

  const change: KasaStateChange = {};
  if (on !== undefined) change.on = on as boolean;
  if (brightness !== undefined) change.brightness = brightness as number;
  return change;
}

/** Brightness is set before switching on, so a dimmer turns on at the requested level. */
export function buildStateCommands(change: KasaStateChange): object[] {
  const commands: object[] = [];
  if (change.brightness !== undefined) {
    commands.push({ "smartlife.iot.dimmer": { set_brightness: { brightness: change.brightness } } });
  }
  if (change.on !== undefined) {
    commands.push({ system: { set_relay_state: { state: change.on ? 1 : 0 } } });
  }
  return commands;
}

/** Throws when any method in a Kasa reply reports a non-zero err_code. */
export function assertKasaOk(response: unknown): void {
  if (!response || typeof response !== "object") throw new Error("Empty reply from Kasa device.");

  for (const [module, methods] of Object.entries(response as Record<string, unknown>)) {
    if (!methods || typeof methods !== "object") continue;
    for (const [method, result] of Object.entries(methods as Record<string, unknown>)) {
      const { err_code, err_msg } = (result ?? {}) as { err_code?: number; err_msg?: string };
      if (err_code !== undefined && err_code !== 0) {
        throw new Error(`Kasa ${module}.${method} failed (${err_code}): ${err_msg ?? "unknown error"}`);
      }
    }
  }
}
