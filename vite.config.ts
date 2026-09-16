import { defineConfig } from "vitest/config";
import { loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { existsSync } from "fs";
import { execFile } from "child_process";
import { randomBytes, timingSafeEqual } from "crypto";
import { parseString } from "xml2js";
import type { IncomingMessage, ServerResponse } from "http";
import { parseNmapHosts } from "./src/utils/nmapParser";
import {
  buildNmapArgs,
  compareIPv4,
  ipInSubnet,
  isIPv4,
  parseSubnets,
  resolveNmapPath,
} from "./src/utils/scanConfig";
import { applyInventory } from "./src/utils/inventory";
import { KNOWN_INFRASTRUCTURE } from "./src/config/infrastructure";
import { validateStateChange } from "./src/utils/kasaProtocol";
import { discoverKasaDevices, getKasaDevice, setKasaState, type KasaCredentials } from "./server/kasa";
import {
  buildAuthorizeUrl,
  exchangeCode,
  getThermostats,
  getTokenExpiry,
  isConnected,
  setThermostatState,
  type ResideoConfig,
} from "./server/resideo";
import { announce, type VoiceMonkeyConfig } from "./server/voicemonkey";
import type { ScanResult } from "./src/types/device";
import type { KasaDevice, KasaDiscoveryResult } from "./src/types/kasa";
import type { ResideoStateChange } from "./src/types/resideo";

const SCAN_TIMEOUT_MS = 120_000;
// Windows STATUS_DLL_NOT_FOUND (0xC0000135), seen as a signed or unsigned exit code.
const DLL_NOT_FOUND_EXIT_CODES = [-1073741515, 3221225781];
const MAX_JSON_BODY_BYTES = 1024;

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, err: unknown, label: string) {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : String(err);
  if (status >= 500) console.error(`${label}: ${message}`);
  sendJson(res, status, { message: status >= 500 ? `${label}: ${message}` : message });
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_JSON_BODY_BYTES) {
        reject(new HttpError(413, "Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"));
      } catch {
        reject(new HttpError(400, "Request body must be JSON."));
      }
    });
    req.on("error", reject);
  });
}

// The dev-server APIs act on this machine and the LAN, so only signed-in app users may call them.
async function isSignedIn(authorization: string | undefined, env: Record<string, string>): Promise<boolean> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || !env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) return false;
  try {
    const res = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function runNmap(nmapPath: string, subnets: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      nmapPath,
      buildNmapArgs(subnets),
      { timeout: SCAN_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          if (error.code === "ENOENT") {
            reject(new Error(`nmap not found at "${nmapPath}". Install nmap or set NMAP_PATH in .env.`));
          } else if (DLL_NOT_FOUND_EXIT_CODES.includes(Number(error.code))) {
            reject(new Error(
              "nmap could not start because a required DLL is missing. " +
              "Install the Visual C++ 2013 x86 runtime (winget install Microsoft.VCRedist.2013.x86).",
            ));
          } else if (error.killed) {
            reject(new Error(`nmap timed out after ${SCAN_TIMEOUT_MS / 1000}s.`));
          } else {
            reject(new Error(stderr.trim() || error.message));
          }
          return;
        }
        if (stderr) console.warn(`nmap stderr: ${stderr}`);
        resolve(stdout);
      },
    );
  });
}

function parseXml(xml: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    parseString(xml, (err: Error | null, result: unknown) => (err ? reject(err) : resolve(result)));
  });
}

// Vite plugin to create a custom API endpoint for network scanning
function networkScanApiPlugin(env: Record<string, string>): Plugin {
  // Dashboard and Devices can request a scan at the same time; share one nmap run.
  let inFlight: Promise<ScanResult> | null = null;

  const scan = async (): Promise<ScanResult> => {
    const subnets = parseSubnets(env.SCAN_SUBNET);
    const nmapPath = resolveNmapPath(env.NMAP_PATH, process.platform, existsSync);
    const started = Date.now();
    const result = await parseXml(await runNmap(nmapPath, subnets));
    const devices = applyInventory(parseNmapHosts(result), KNOWN_INFRASTRUCTURE, subnets);
    return { subnets, scannedAt: new Date().toISOString(), durationMs: Date.now() - started, devices };
  };

  return {
    name: "network-scan-api",
    configureServer(server) {
      server.middlewares.use("/api/scan", async (req, res) => {
        if (req.method !== "GET") {
          sendJson(res, 405, { message: "Method not allowed." });
          return;
        }
        if (!(await isSignedIn(req.headers.authorization, env))) {
          sendJson(res, 401, { message: "Sign in to run a network scan." });
          return;
        }
        try {
          inFlight ??= scan().finally(() => {
            inFlight = null;
          });
          sendJson(res, 200, await inFlight);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`Network scan failed: ${message}`);
          sendJson(res, 500, { message: `Network scan failed: ${message}` });
        }
      });
    },
  };
}

// Vite plugin to read and switch TP-Link Kasa devices over the LAN (legacy protocol or KLAP)
function kasaApiPlugin(env: Record<string, string>): Plugin {
  // TP-Link account for KLAP devices. Server-only: these variables have no VITE_ prefix.
  const credentials: KasaCredentials | null =
    env.KASA_USERNAME && env.KASA_PASSWORD ? { username: env.KASA_USERNAME, password: env.KASA_PASSWORD } : null;
  const known = new Map<string, KasaDevice>();
  let inFlight: Promise<KasaDiscoveryResult> | null = null;

  const discover = async (): Promise<KasaDiscoveryResult> => {
    const subnets = parseSubnets(env.SCAN_SUBNET);
    const started = Date.now();
    const { devices: answered, locked, skippedSubnets } = await discoverKasaDevices(subnets, credentials);
    for (const device of answered) known.set(device.ip, device);
    // A switch that moved to KLAP without credentials is listed as locked, not as a stale offline switch.
    for (const device of locked) known.delete(device.ip);

    // A switch can miss the broadcast: ask the ones seen before directly, and mark them offline if they stay silent.
    const answeredIps = new Set(answered.map((d) => d.ip));
    const silent = [...known.values()].filter((d) => !answeredIps.has(d.ip));
    const rechecked = await Promise.all(
      silent.map((d) =>
        getKasaDevice(d.ip, d.protocol, credentials).catch((): KasaDevice => ({ ...d, online: false })),
      ),
    );
    for (const device of rechecked) known.set(device.ip, device);

    const devices = [...known.values()]
      .filter((d) => subnets.some((s) => ipInSubnet(d.ip, s)))
      .sort((a, b) => compareIPv4(a.ip, b.ip));
    return {
      subnets,
      skippedSubnets,
      locked,
      discoveredAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      devices,
    };
  };

  return {
    name: "kasa-api",
    configureServer(server) {
      server.middlewares.use("/api/kasa/devices", async (req, res) => {
        if (!(await isSignedIn(req.headers.authorization, env))) {
          sendJson(res, 401, { message: "Sign in to use Kasa devices." });
          return;
        }

        try {
          const route = (req.url ?? "/").split("?")[0];

          if (route === "/" || route === "") {
            if (req.method !== "GET") throw new HttpError(405, "Method not allowed.");
            inFlight ??= discover().finally(() => {
              inFlight = null;
            });
            sendJson(res, 200, await inFlight);
            return;
          }

          const stateRoute = route.match(/^\/([^/]+)\/state\/?$/);
          if (!stateRoute) throw new HttpError(404, "Not found.");
          if (req.method !== "POST") throw new HttpError(405, "Method not allowed.");

          const ip = decodeURIComponent(stateRoute[1]);
          const subnets = parseSubnets(env.SCAN_SUBNET);
          const device = isIPv4(ip) && subnets.some((s) => ipInSubnet(ip, s)) ? known.get(ip) : undefined;
          if (!device) throw new HttpError(404, "Unknown Kasa device. Refresh the device list first.");

          let change;
          try {
            change = validateStateChange(await readJsonBody(req));
          } catch (err) {
            throw err instanceof HttpError ? err : new HttpError(400, err instanceof Error ? err.message : String(err));
          }
          if (change.brightness !== undefined && device.brightness === null) {
            throw new HttpError(400, `${device.alias} is not a dimmer.`);
          }

          const updated = await setKasaState(ip, device.protocol, credentials, change);
          known.set(ip, updated);
          sendJson(res, 200, updated);
        } catch (err) {
          sendError(res, err, "Kasa request failed");
        }
      });
    },
  };
}

// Vite plugin for the Resideo (Honeywell Home) cloud thermostat API: OAuth connect/callback plus
// read/write of the connected account's thermostats. Returns null when RESIDEO_CLIENT_ID/SECRET are
// not set, so the routes cleanly 404 instead of half-working.
function resideoApiPlugin(env: Record<string, string>): Plugin | null {
  if (!env.RESIDEO_CLIENT_ID || !env.RESIDEO_CLIENT_SECRET) return null;

  const config: ResideoConfig = {
    clientId: env.RESIDEO_CLIENT_ID,
    clientSecret: env.RESIDEO_CLIENT_SECRET,
    redirectUri: env.RESIDEO_REDIRECT_URI || "http://localhost:8080/api/resideo/callback",
    tokenFile: path.resolve(__dirname, "server/.resideo-tokens.json"),
  };
  let inFlight: Promise<import("./src/types/resideo").ResideoThermostat[]> | null = null;
  // The ?state we sent on the last /connect, kept so /callback can reject a code that did not
  // come from a flow this server started. Cleared as soon as it is used or expires.
  let pendingState: { value: string; expiresAt: number } | null = null;
  const STATE_TTL_MS = 10 * 60_000;

  return {
    name: "resideo-api",
    configureServer(server) {
      // Full-page navigation: the browser can't attach an Authorization header here, so this
      // route (and /callback below) relies on being reachable only from this machine's own
      // localhost dev server rather than on isSignedIn. /devices and /devices/:id/state below
      // still require a signed-in session, same as Kasa.
      server.middlewares.use("/api/resideo/connect", (_req, res) => {
        const state = randomBytes(32).toString("hex");
        pendingState = { value: state, expiresAt: Date.now() + STATE_TTL_MS };
        res.statusCode = 302;
        res.setHeader("Location", buildAuthorizeUrl(config, state));
        res.end();
      });

      server.middlewares.use("/api/resideo/callback", async (req, res) => {
        try {
          const url = new URL(req.url ?? "/", "http://localhost");
          const code = url.searchParams.get("code");
          const oauthError = url.searchParams.get("error");
          if (oauthError) throw new HttpError(400, `Resideo declined authorization: ${oauthError}`);
          if (!code) throw new HttpError(400, "Missing ?code from Resideo.");

          // Without this, anything that can make this browser hit /callback could bind the
          // dev server to someone else's Resideo account. Compared in constant time, and the
          // state is single-use so a replayed callback is rejected too.
          const state = url.searchParams.get("state") ?? "";
          const expected = pendingState;
          pendingState = null;
          if (!expected || Date.now() > expected.expiresAt) {
            throw new HttpError(400, "No authorization is in progress. Start again from Settings.");
          }
          const given = Buffer.from(state);
          const want = Buffer.from(expected.value);
          if (given.length !== want.length || !timingSafeEqual(given, want)) {
            throw new HttpError(400, "State mismatch — this callback did not come from Home Nexus.");
          }

          await exchangeCode(config, code);
          res.statusCode = 302;
          res.setHeader("Location", "/settings?resideo=connected");
          res.end();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`Resideo callback failed: ${message}`);
          res.statusCode = 302;
          res.setHeader("Location", `/settings?resideo=error&message=${encodeURIComponent(message)}`);
          res.end();
        }
      });

      server.middlewares.use("/api/resideo/status", async (req, res) => {
        if (!(await isSignedIn(req.headers.authorization, env))) {
          sendJson(res, 401, { message: "Sign in to check Resideo status." });
          return;
        }
        const connected = await isConnected(config);
        sendJson(res, 200, { connected, expiresAt: connected ? await getTokenExpiry(config) : undefined });
      });

      server.middlewares.use("/api/resideo/devices", async (req, res) => {
        if (!(await isSignedIn(req.headers.authorization, env))) {
          sendJson(res, 401, { message: "Sign in to use Resideo devices." });
          return;
        }
        try {
          const route = (req.url ?? "/").split("?")[0];

          if (route === "/" || route === "") {
            if (req.method !== "GET") throw new HttpError(405, "Method not allowed.");
            if (!(await isConnected(config))) {
              sendJson(res, 200, { connected: false, devices: [], fetchedAt: new Date().toISOString(), durationMs: 0 });
              return;
            }
            const started = Date.now();
            inFlight ??= getThermostats(config).finally(() => {
              inFlight = null;
            });
            const devices = await inFlight;
            sendJson(res, 200, { connected: true, devices, fetchedAt: new Date().toISOString(), durationMs: Date.now() - started });
            return;
          }

          const stateRoute = route.match(/^\/([^/]+)\/state\/?$/);
          if (!stateRoute) throw new HttpError(404, "Not found.");
          if (req.method !== "POST") throw new HttpError(405, "Method not allowed.");

          const deviceId = decodeURIComponent(stateRoute[1]);
          const body = (await readJsonBody(req)) as ResideoStateChange & { locationId?: number };
          if (typeof body.locationId !== "number") throw new HttpError(400, "locationId is required.");

          const { locationId, ...change } = body;
          const updated = await setThermostatState(config, locationId, deviceId, change);
          sendJson(res, 200, updated);
        } catch (err) {
          sendError(res, err, "Resideo request failed");
        }
      });
    },
  };
}

// Vite plugin for Voice Monkey (HTTP→Alexa announcements). Returns null when VOICEMONKEY_TOKEN /
// VOICEMONKEY_DEVICE_ID are not set, so the route cleanly 404s instead of half-working.
function voiceMonkeyApiPlugin(env: Record<string, string>): Plugin | null {
  if (!env.VOICEMONKEY_TOKEN || !env.VOICEMONKEY_DEVICE_ID) return null;
  const config: VoiceMonkeyConfig = { token: env.VOICEMONKEY_TOKEN, deviceId: env.VOICEMONKEY_DEVICE_ID };

  return {
    name: "voicemonkey-api",
    configureServer(server) {
      server.middlewares.use("/api/voicemonkey/announce", async (req, res) => {
        if (!(await isSignedIn(req.headers.authorization, env))) {
          sendJson(res, 401, { message: "Sign in to send announcements." });
          return;
        }
        if (req.method !== "POST") {
          sendJson(res, 405, { message: "Method not allowed." });
          return;
        }
        try {
          const body = (await readJsonBody(req)) as { text?: string; deviceId?: string };
          if (!body.text) throw new HttpError(400, "text is required.");
          await announce(config, body.text, body.deviceId);
          sendJson(res, 200, { ok: true });
        } catch (err) {
          sendError(res, err, "Voice Monkey announcement failed");
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load every .env variable (not only VITE_*) so the server-side settings reach the plugins.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      networkScanApiPlugin(env),
      kasaApiPlugin(env),
      resideoApiPlugin(env),
      voiceMonkeyApiPlugin(env),
    ].filter(Boolean) as Plugin[],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.{test,spec}.{ts,tsx}", "server/**/*.test.ts"],
      deps: {
        inline: [/class-variance-authority/],
      },
    },
  };
});
