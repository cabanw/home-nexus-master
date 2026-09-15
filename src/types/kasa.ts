/** "legacy": XOR protocol on TCP/UDP 9999. "klap": TP-Link's encrypted HTTP protocol, which needs account credentials. */
export type KasaProtocol = "legacy" | "klap";

export interface KasaDevice {
  /** MAC address, used as a stable id. */
  id: string;
  ip: string;
  alias: string;
  model: string;
  deviceName: string;
  mac: string;
  protocol: KasaProtocol;
  on: boolean;
  /** 1-100 for dimmers, null for plain switches. */
  brightness: number | null;
  firmware: string;
  /** False when a previously seen switch did not answer the last discovery. */
  online: boolean;
  lastSeen: string;
}

/** A switch that answered discovery but cannot be read or controlled. */
export interface KasaLockedDevice {
  ip: string;
  model: string;
  mac: string;
  reason: string;
}

export interface KasaDiscoveryResult {
  subnets: string[];
  /** Subnets in SCAN_SUBNET where this computer has no adapter, so broadcast discovery cannot reach them. */
  skippedSubnets: string[];
  locked: KasaLockedDevice[];
  discoveredAt: string;
  durationMs: number;
  devices: KasaDevice[];
}

export interface KasaStateChange {
  on?: boolean;
  brightness?: number;
}
