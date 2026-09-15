export interface ScannedDevice {
  id: string;
  name: string;
  ip: string;
  mac: string;
  type: string;
  status: 'online' | 'offline';
  /** ISO timestamp, or null for a known device that did not answer the scan. */
  lastSeen: string | null;
}

export interface ScanResult {
  subnets: string[];
  scannedAt: string;
  durationMs: number;
  devices: ScannedDevice[];
}
