export interface ScannedDevice {
  id: string;
  name: string;
  ip: string;
  mac: string;
  type: string;
  status: 'online' | 'offline';
  security: string;
  lastSeen: string;
  bandwidth: number;
}

export function parseNmapHost(host: any): ScannedDevice {
  const ipv4 = host.address?.find((addr: any) => addr?.$?.addrtype === 'ipv4');
  const mac = host.address?.find((addr: any) => addr?.$?.addrtype === 'mac');
  const vendor = mac?.$?.vendor ?? null;

  let name = 'Unknown Device';
  if (host.hostnames?.[0]?.hostname?.[0]?.$?.name) {
    name = host.hostnames[0].hostname[0].$.name;
  } else if (vendor) {
    name = vendor;
  }

  const lastchangedRaw = host.status?.[0]?.$?.lastchanged;
  const lastSeenMs = lastchangedRaw !== undefined
    ? Number(lastchangedRaw) * 1000
    : Date.now();

  return {
    id: mac?.$?.addr ?? ipv4?.$?.addr ?? Math.random().toString(),
    name,
    ip: ipv4?.$?.addr ?? 'N/A',
    mac: mac?.$?.addr ?? 'N/A',
    type: 'unknown',
    status: host.status?.[0]?.$?.state === 'up' ? 'online' : 'offline',
    security: 'unknown',
    lastSeen: new Date(lastSeenMs).toISOString(),
    bandwidth: 0,
  };
}

export function parseNmapHosts(nmapResult: any): ScannedDevice[] {
  const hosts = nmapResult?.nmaprun?.host ?? [];
  return hosts.map(parseNmapHost);
}
