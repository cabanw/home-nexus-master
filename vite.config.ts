import { defineConfig } from "vitest/config";
import { loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { existsSync } from "fs";
import { execFile } from "child_process";
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
import type { ScanResult } from "./src/types/device";
import type { KasaDevice, KasaDiscoveryResult } from "./src/types/kasa";

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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load every .env variable (not only VITE_*) so the server-side settings reach the plugins.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), networkScanApiPlugin(env), kasaApiPlugin(env)],
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
