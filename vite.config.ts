import { defineConfig } from "vitest/config";
import { loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { existsSync } from "fs";
import { execFile } from "child_process";
import { parseString } from "xml2js";
import type { ServerResponse } from "http";
import { parseNmapHosts } from "./src/utils/nmapParser";
import { buildNmapArgs, parseSubnets, resolveNmapPath } from "./src/utils/scanConfig";
import { applyInventory } from "./src/utils/inventory";
import { KNOWN_INFRASTRUCTURE } from "./src/config/infrastructure";
import type { ScanResult } from "./src/types/device";

const SCAN_TIMEOUT_MS = 120_000;
// Windows STATUS_DLL_NOT_FOUND (0xC0000135), seen as a signed or unsigned exit code.
const DLL_NOT_FOUND_EXIT_CODES = [-1073741515, 3221225781];

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

// The scan endpoint runs nmap on this machine, so only signed-in app users may call it.
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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load every .env variable (not only VITE_*) so the scan settings reach the server.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), networkScanApiPlugin(env)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      deps: {
        inline: [/class-variance-authority/],
      },
    },
  };
});
