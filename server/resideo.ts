import { readFile, writeFile, mkdir, chmod } from "fs/promises";
import { dirname } from "path";
import type {
  ResideoFanMode,
  ResideoMode,
  ResideoStateChange,
  ResideoThermostat,
} from "../src/types/resideo";

const AUTH_BASE = "https://api.honeywellhome.com";
const TOKEN_URL = `${AUTH_BASE}/oauth2/token`;
const AUTHORIZE_URL = `${AUTH_BASE}/oauth2/authorize`;
const API_BASE = "https://api.honeywellhome.com/v2";
// Access tokens are short-lived (~10 min per Resideo's docs); refresh a bit early.
const TOKEN_REFRESH_SKEW_MS = 60_000;

export interface ResideoConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Where the refresh/access tokens are persisted between dev-server restarts. */
  tokenFile: string;
}

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. */
  expiresAt: number;
}

let cached: StoredTokens | null = null;

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function loadTokens(tokenFile: string): Promise<StoredTokens | null> {
  if (cached) return cached;
  try {
    cached = JSON.parse(await readFile(tokenFile, "utf8"));
    return cached;
  } catch {
    return null;
  }
}

async function saveTokens(tokenFile: string, tokens: StoredTokens): Promise<void> {
  cached = tokens;
  await mkdir(dirname(tokenFile), { recursive: true });
  // These are long-lived credentials to the Resideo account, so the file is owner-only rather
  // than the default world-readable mode. `mode` only applies when the file is created, so an
  // existing one is tightened explicitly.
  await writeFile(tokenFile, JSON.stringify(tokens, null, 2), { encoding: "utf8", mode: 0o600 });
  await chmod(tokenFile, 0o600);
}

export function buildAuthorizeUrl(config: ResideoConfig, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function requestToken(config: ResideoConfig, body: URLSearchParams): Promise<StoredTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(config.clientId, config.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`Resideo token request failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in: string | number };
  const tokens: StoredTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  };
  await saveTokens(config.tokenFile, tokens);
  return tokens;
}

/** Exchanges the authorization code from the OAuth redirect for the first set of tokens. */
export function exchangeCode(config: ResideoConfig, code: string): Promise<StoredTokens> {
  return requestToken(
    config,
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: config.redirectUri }),
  );
}

/** Returns a valid access token, refreshing it first if it has expired or is close to expiring. */
async function getAccessToken(config: ResideoConfig): Promise<string> {
  const tokens = await loadTokens(config.tokenFile);
  if (!tokens) throw new Error("Resideo is not connected yet.");
  if (Date.now() < tokens.expiresAt - TOKEN_REFRESH_SKEW_MS) return tokens.accessToken;

  const refreshed = await requestToken(
    config,
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.refreshToken }),
  );
  return refreshed.accessToken;
}

export async function isConnected(config: ResideoConfig): Promise<boolean> {
  return (await loadTokens(config.tokenFile)) !== null;
}

export async function getTokenExpiry(config: ResideoConfig): Promise<string | null> {
  const tokens = await loadTokens(config.tokenFile);
  return tokens ? new Date(tokens.expiresAt).toISOString() : null;
}

async function apiGet(config: ResideoConfig, path: string, params: Record<string, string> = {}): Promise<unknown> {
  const accessToken = await getAccessToken(config);
  const query = new URLSearchParams({ apikey: config.clientId, ...params });
  const res = await fetch(`${API_BASE}${path}?${query.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Resideo API GET ${path} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function apiPost(
  config: ResideoConfig,
  path: string,
  params: Record<string, string>,
  body: object,
): Promise<void> {
  const accessToken = await getAccessToken(config);
  const query = new URLSearchParams({ apikey: config.clientId, ...params });
  const res = await fetch(`${API_BASE}${path}?${query.toString()}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Resideo API POST ${path} failed (${res.status}): ${await res.text()}`);
}

// Raw shapes from the v2 API — only the fields this app actually uses.
interface RawLocation {
  locationID: number;
  devices: RawThermostat[];
}
interface RawThermostat {
  deviceID: string;
  userDefinedDeviceName?: string;
  name?: string;
  deviceModel?: string;
  macID: string;
  units: "Fahrenheit" | "Celsius";
  indoorTemperature: number;
  indoorHumidity?: number;
  outdoorTemperature?: number;
  allowedModes: ResideoMode[];
  minHeatSetpoint: number;
  maxHeatSetpoint: number;
  minCoolSetpoint: number;
  maxCoolSetpoint: number;
  isAlive: boolean;
  settings?: { fan?: { allowedModes?: ResideoFanMode[]; changeableValues?: { mode?: ResideoFanMode } } };
  changeableValues: {
    mode: ResideoMode;
    heatSetpoint: number;
    coolSetpoint: number;
    thermostatSetpointStatus: string;
  };
}

function toThermostat(locationId: number, raw: RawThermostat): ResideoThermostat {
  return {
    deviceId: raw.deviceID,
    locationId,
    name: raw.userDefinedDeviceName || raw.name || raw.deviceID,
    model: raw.deviceModel ?? "Unknown",
    macId: raw.macID,
    units: raw.units,
    indoorTemperature: raw.indoorTemperature,
    indoorHumidity: raw.indoorHumidity ?? null,
    outdoorTemperature: raw.outdoorTemperature ?? null,
    mode: raw.changeableValues.mode,
    allowedModes: raw.allowedModes,
    heatSetpoint: raw.changeableValues.heatSetpoint,
    coolSetpoint: raw.changeableValues.coolSetpoint,
    minSetpoint: Math.min(raw.minHeatSetpoint, raw.minCoolSetpoint),
    maxSetpoint: Math.max(raw.maxHeatSetpoint, raw.maxCoolSetpoint),
    fanMode: raw.settings?.fan?.changeableValues?.mode ?? "Auto",
    allowedFanModes: raw.settings?.fan?.allowedModes ?? ["Auto"],
    setpointStatus: raw.changeableValues.thermostatSetpointStatus,
    isAlive: raw.isAlive,
    online: raw.isAlive,
    lastSeen: new Date().toISOString(),
  };
}

/** Every thermostat across every location on the connected Resideo account. */
export async function getThermostats(config: ResideoConfig): Promise<ResideoThermostat[]> {
  const locations = (await apiGet(config, "/locations")) as RawLocation[];
  return locations.flatMap((loc) => loc.devices.map((device) => toThermostat(loc.locationID, device)));
}

/** Applies a state change to one thermostat and returns it as Resideo reports it afterwards. */
export async function setThermostatState(
  config: ResideoConfig,
  locationId: number,
  deviceId: string,
  change: ResideoStateChange,
): Promise<ResideoThermostat> {
  const current = (await apiGet(config, `/devices/thermostats/${deviceId}`, {
    locationId: String(locationId),
  })) as RawThermostat;

  await apiPost(config, `/devices/thermostats/${deviceId}`, { locationId: String(locationId) }, {
    mode: change.mode ?? current.changeableValues.mode,
    heatSetpoint: change.heatSetpoint ?? current.changeableValues.heatSetpoint,
    coolSetpoint: change.coolSetpoint ?? current.changeableValues.coolSetpoint,
    thermostatSetpointStatus: change.resumeSchedule ? "NoHold" : "TemporaryHold",
    ...(change.fanMode ? { fan: { mode: change.fanMode } } : {}),
  });

  const updated = (await apiGet(config, `/devices/thermostats/${deviceId}`, {
    locationId: String(locationId),
  })) as RawThermostat;
  return toThermostat(locationId, updated);
}
