import type { ScannedDevice } from "../types/device";
import { ipInSubnet } from "./scanConfig";

export interface InfrastructureDevice {
  ip: string;
  name: string;
  role: string;
}

/**
 * Labels scanned devices that match known infrastructure, and adds any known
 * device inside the scanned subnets that did not answer as offline.
 */
export function applyInventory(
  devices: ScannedDevice[],
  inventory: InfrastructureDevice[],
  subnets: string[],
): ScannedDevice[] {
  const byIp = new Map(inventory.map((d) => [d.ip, d]));
  const found = new Set<string>();

  const labeled = devices.map((device) => {
    const known = byIp.get(device.ip);
    if (!known) return device;
    found.add(known.ip);
    return { ...device, name: known.name, type: known.role };
  });

  const missing: ScannedDevice[] = inventory
    .filter((d) => !found.has(d.ip) && subnets.some((s) => ipInSubnet(d.ip, s)))
    .map((d) => ({
      id: `infra-${d.ip}`,
      name: d.name,
      ip: d.ip,
      mac: "N/A",
      type: d.role,
      status: "offline",
      lastSeen: null,
    }));

  return [...labeled, ...missing];
}
