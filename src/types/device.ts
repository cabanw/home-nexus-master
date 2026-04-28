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
