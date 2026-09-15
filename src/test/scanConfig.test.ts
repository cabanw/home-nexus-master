import { describe, it, expect } from 'vitest';
import {
  buildNmapArgs,
  compareIPv4,
  ipInSubnet,
  isIPv4,
  localAddressInSubnet,
  parseSubnets,
  resolveNmapPath,
  subnetBroadcast,
  WINDOWS_NMAP_PATHS,
} from '@/utils/scanConfig';
import { applyInventory } from '@/utils/inventory';
import type { ScannedDevice } from '@/types/device';

describe('localAddressInSubnet', () => {
  const addresses = [
    { address: '192.168.254.125', family: 'IPv4', internal: false },
    { address: '127.0.0.1', family: 'IPv4', internal: true },
    { address: 'fe80::1', family: 'IPv6', internal: false },
    { address: '172.16.40.100', family: 'IPv4', internal: false },
  ];

  it('returns the adapter address inside the subnet', () => {
    expect(localAddressInSubnet(addresses, '172.16.40.0/24')).toBe('172.16.40.100');
  });

  it('accepts the numeric family used by older Node versions', () => {
    expect(localAddressInSubnet([{ address: '10.0.0.5', family: 4, internal: false }], '10.0.0.0/24')).toBe('10.0.0.5');
  });

  it('returns null when no adapter is on the subnet', () => {
    expect(localAddressInSubnet(addresses, '172.16.50.0/24')).toBeNull();
    expect(localAddressInSubnet(addresses, '127.0.0.0/8')).toBeNull();
  });
});

describe('subnetBroadcast', () => {
  it.each([
    ['172.16.40.0/24', '172.16.40.255'],
    ['172.16.40.107/25', '172.16.40.127'],
    ['10.1.0.0/16', '10.1.255.255'],
    ['192.168.1.7/32', '192.168.1.7'],
  ])('%s -> %s', (cidr, broadcast) => {
    expect(subnetBroadcast(cidr)).toBe(broadcast);
  });

  it('rejects invalid subnets', () => {
    expect(() => subnetBroadcast('172.16.40.0')).toThrow();
  });
});

describe('isIPv4 / compareIPv4', () => {
  it('validates IPv4 addresses', () => {
    expect(isIPv4('172.16.40.25')).toBe(true);
    expect(isIPv4('172.16.40.256')).toBe(false);
    expect(isIPv4('../etc')).toBe(false);
  });

  it('sorts addresses numerically', () => {
    expect(['172.16.40.122', '172.16.40.25', '172.16.40.3'].sort(compareIPv4)).toEqual([
      '172.16.40.3', '172.16.40.25', '172.16.40.122',
    ]);
  });
});

describe('parseSubnets', () => {
  it('accepts a single subnet', () => {
    expect(parseSubnets('172.16.40.0/24')).toEqual(['172.16.40.0/24']);
  });

  it('accepts several subnets separated by commas or spaces and drops duplicates', () => {
    expect(parseSubnets(' 172.16.40.0/24, 172.16.50.0/24 172.16.40.0/24')).toEqual([
      '172.16.40.0/24',
      '172.16.50.0/24',
    ]);
  });

  it('throws when the value is missing', () => {
    expect(() => parseSubnets(undefined)).toThrow(/SCAN_SUBNET is not set/);
    expect(() => parseSubnets('  ')).toThrow(/SCAN_SUBNET is not set/);
  });

  it.each([
    '172.16.40.0',
    '172.16.40.0/8',
    '300.16.40.0/24',
    '172.16.40.0/24;calc',
    '--script=evil',
  ])('rejects %s', (value) => {
    expect(() => parseSubnets(value)).toThrow(/Invalid SCAN_SUBNET entry/);
  });
});

describe('resolveNmapPath', () => {
  it('prefers NMAP_PATH when set', () => {
    expect(resolveNmapPath(' D:\\tools\\nmap.exe ', 'win32', () => false)).toBe('D:\\tools\\nmap.exe');
  });

  it('uses the standard Windows install when present', () => {
    expect(resolveNmapPath('', 'win32', (p) => p === WINDOWS_NMAP_PATHS[0])).toBe(WINDOWS_NMAP_PATHS[0]);
  });

  it('falls back to nmap on PATH on Windows', () => {
    expect(resolveNmapPath(undefined, 'win32', () => false)).toBe('nmap');
  });

  it('uses the bundled binary on Linux when present', () => {
    expect(resolveNmapPath(undefined, 'linux', (p) => p === './nmap')).toBe('./nmap');
    expect(resolveNmapPath(undefined, 'linux', () => false)).toBe('nmap');
  });
});

describe('buildNmapArgs', () => {
  it('runs host discovery with XML output for every subnet', () => {
    expect(buildNmapArgs(['172.16.40.0/24', '172.16.50.0/24'])).toEqual([
      '-sn', '-T4', '-oX', '-', '172.16.40.0/24', '172.16.50.0/24',
    ]);
  });
});

describe('ipInSubnet', () => {
  it('matches addresses inside the subnet', () => {
    expect(ipInSubnet('172.16.40.1', '172.16.40.0/24')).toBe(true);
    expect(ipInSubnet('172.16.40.255', '172.16.40.0/24')).toBe(true);
  });

  it('rejects addresses outside the subnet or malformed input', () => {
    expect(ipInSubnet('172.16.41.1', '172.16.40.0/24')).toBe(false);
    expect(ipInSubnet('172.16.40.200', '172.16.40.0/25')).toBe(false);
    expect(ipInSubnet('N/A', '172.16.40.0/24')).toBe(false);
  });
});

describe('applyInventory', () => {
  const inventory = [
    { ip: '172.16.40.1', name: 'Gateway', role: 'gateway' },
    { ip: '172.16.40.250', name: 'AP', role: 'access-point' },
    { ip: '172.16.50.1', name: 'Other VLAN', role: 'gateway' },
  ];

  const scanned: ScannedDevice = {
    id: '38:A0:67:63:23:F2',
    name: 'Unknown Device',
    ip: '172.16.40.1',
    mac: '38:A0:67:63:23:F2',
    type: 'unknown',
    status: 'online',
    lastSeen: '2026-09-14T00:00:00.000Z',
  };

  it('labels scanned devices that match the inventory', () => {
    const [gateway] = applyInventory([scanned], inventory, ['172.16.40.0/24']);
    expect(gateway).toMatchObject({ name: 'Gateway', type: 'gateway', status: 'online', mac: scanned.mac });
  });

  it('adds known devices in scanned subnets that did not answer as offline', () => {
    const result = applyInventory([scanned], inventory, ['172.16.40.0/24']);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ ip: '172.16.40.250', status: 'offline', lastSeen: null });
  });

  it('ignores known devices outside the scanned subnets', () => {
    const result = applyInventory([], inventory, ['172.16.40.0/24']);
    expect(result.map((d) => d.ip)).not.toContain('172.16.50.1');
  });
});
