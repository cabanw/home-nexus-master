import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseNmapHost, parseNmapHosts } from '@/utils/nmapParser';

const makeHost = (overrides: any = {}) => ({
  address: [
    { $: { addrtype: 'ipv4', addr: '192.168.1.10' } },
    { $: { addrtype: 'mac', addr: 'AA:BB:CC:DD:EE:FF', vendor: 'Apple' } },
  ],
  hostnames: [{ hostname: [{ $: { name: 'my-device.local' } }] }],
  status: [{ $: { state: 'up', lastchanged: '1700000000' } }],
  ...overrides,
});

describe('parseNmapHost', () => {
  it('populates all fields from a complete host', () => {
    const device = parseNmapHost(makeHost());
    expect(device.ip).toBe('192.168.1.10');
    expect(device.mac).toBe('AA:BB:CC:DD:EE:FF');
    expect(device.name).toBe('my-device.local');
    expect(device.status).toBe('online');
    expect(device.lastSeen).toBe(new Date(1700000000 * 1000).toISOString());
    expect(device.bandwidth).toBe(0);
    expect(device.type).toBe('unknown');
  });

  it('falls back to Date.now() when lastchanged is absent', () => {
    const before = Date.now();
    const device = parseNmapHost(makeHost({ status: [{ $: { state: 'up' } }] }));
    const after = Date.now();
    const seen = new Date(device.lastSeen).getTime();
    expect(seen).toBeGreaterThanOrEqual(before);
    expect(seen).toBeLessThanOrEqual(after);
  });

  it('returns offline when state is down', () => {
    const device = parseNmapHost(makeHost({ status: [{ $: { state: 'down' } }] }));
    expect(device.status).toBe('offline');
  });

  it('returns N/A and Unknown Device when addresses are missing', () => {
    const device = parseNmapHost({ address: [], hostnames: [], status: [{ $: { state: 'up' } }] });
    expect(device.ip).toBe('N/A');
    expect(device.mac).toBe('N/A');
    expect(device.name).toBe('Unknown Device');
  });

  it('uses vendor as name when hostname is absent', () => {
    const device = parseNmapHost(makeHost({ hostnames: [] }));
    expect(device.name).toBe('Apple');
  });
});

describe('parseNmapHosts', () => {
  it('returns an empty array when nmaprun has no hosts', () => {
    expect(parseNmapHosts({ nmaprun: {} })).toEqual([]);
  });

  it('maps multiple hosts correctly', () => {
    const result = parseNmapHosts({ nmaprun: { host: [makeHost(), makeHost()] } });
    expect(result).toHaveLength(2);
  });
});
