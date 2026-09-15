const OCTET = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
// Prefixes below /16 would mean scanning 65k+ addresses, so they are rejected.
const CIDR_RE = new RegExp(`^${OCTET}(\\.${OCTET}){3}\\/(1[6-9]|2\\d|3[0-2])$`);
const IPV4_RE = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`);

export const WINDOWS_NMAP_PATHS = [
  "C:\\Program Files (x86)\\Nmap\\nmap.exe",
  "C:\\Program Files\\Nmap\\nmap.exe",
];

/**
 * Parses SCAN_SUBNET, which may hold one or more CIDR subnets separated by
 * commas or spaces. Only strict IPv4 CIDR values are accepted, so the result
 * is safe to pass to nmap as arguments.
 */
export function parseSubnets(raw: string | undefined): string[] {
  const subnets = (raw ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (subnets.length === 0) {
    throw new Error("SCAN_SUBNET is not set. Add it to .env, e.g. SCAN_SUBNET=172.16.40.0/24");
  }

  const invalid = subnets.filter((s) => !CIDR_RE.test(s));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid SCAN_SUBNET entry: ${invalid.join(", ")}. Use CIDR notation between /16 and /32, e.g. 172.16.40.0/24`,
    );
  }

  return [...new Set(subnets)];
}

/**
 * Picks the nmap executable: NMAP_PATH when set, otherwise the standard
 * Windows install location, or the repo's bundled Linux binary.
 */
export function resolveNmapPath(
  configured: string | undefined,
  platform: string,
  exists: (path: string) => boolean,
): string {
  if (configured?.trim()) return configured.trim();
  if (platform === "win32") return WINDOWS_NMAP_PATHS.find(exists) ?? "nmap";
  return exists("./nmap") ? "./nmap" : "nmap";
}

/** Host discovery only (-sn): no port scan, so a /24 finishes in seconds. */
export function buildNmapArgs(subnets: string[]): string[] {
  return ["-sn", "-T4", "-oX", "-", ...subnets];
}

function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => acc * 256 + Number(octet), 0);
}

export function ipInSubnet(ip: string, cidr: string): boolean {
  if (!IPV4_RE.test(ip) || !CIDR_RE.test(cidr)) return false;
  const [base, bits] = cidr.split("/");
  const size = 2 ** (32 - Number(bits));
  const start = Math.floor(ipToInt(base) / size) * size;
  const value = ipToInt(ip);
  return value >= start && value < start + size;
}
