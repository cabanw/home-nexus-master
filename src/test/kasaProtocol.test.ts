// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  assertKasaOk,
  buildStateCommands,
  decrypt,
  encrypt,
  frame,
  GET_SYSINFO,
  parseSysinfo,
  unframe,
  validateStateChange,
} from '@/utils/kasaProtocol';

const seenAt = new Date('2026-09-14T12:00:00.000Z');

const hs200Sysinfo = {
  system: {
    get_sysinfo: {
      sw_ver: '1.0.11 Build 230908 Rel.160526',
      model: 'HS200(US)',
      alias: 'Hallway ',
      mic_type: 'IOT.SMARTPLUGSWITCH',
      mac: '28:EE:52:00:00:01',
      relay_state: 1,
      dev_name: 'Smart Wi-Fi Light Switch',
      latitude_i: 123456,
      longitude_i: -654321,
      err_code: 0,
    },
  },
};

describe('encrypt / decrypt', () => {
  it('uses the XOR autokey cipher starting at 171', () => {
    expect(Array.from(encrypt(JSON.stringify(GET_SYSINFO)).slice(0, 3))).toEqual([208, 242, 129]);
  });

  it('round-trips text', () => {
    const text = '{"system":{"set_relay_state":{"state":1}}}';
    expect(decrypt(encrypt(text))).toBe(text);
  });
});

describe('frame / unframe', () => {
  it('prefixes the payload with its big-endian length', () => {
    expect(Array.from(frame(new Uint8Array([7, 8, 9])))).toEqual([0, 0, 0, 3, 7, 8, 9]);
  });

  it('waits until the whole message has arrived', () => {
    const framed = frame(new Uint8Array([1, 2, 3, 4]));
    expect(unframe(framed.subarray(0, 3))).toBeNull();
    expect(unframe(framed.subarray(0, 6))).toBeNull();
    expect(Array.from(unframe(framed)!)).toEqual([1, 2, 3, 4]);
  });
});

describe('parseSysinfo', () => {
  it('maps a switch and trims its alias', () => {
    expect(parseSysinfo('172.16.40.25', hs200Sysinfo, seenAt)).toEqual({
      id: '28:EE:52:00:00:01',
      ip: '172.16.40.25',
      alias: 'Hallway',
      model: 'HS200(US)',
      deviceName: 'Smart Wi-Fi Light Switch',
      mac: '28:EE:52:00:00:01',
      on: true,
      brightness: null,
      firmware: '1.0.11 Build 230908 Rel.160526',
      online: true,
      lastSeen: '2026-09-14T12:00:00.000Z',
    });
  });

  it('never copies location data from the device', () => {
    const json = JSON.stringify(parseSysinfo('172.16.40.25', hs200Sysinfo, seenAt));
    expect(json).not.toContain('123456');
    expect(json).not.toContain('latitude');
  });

  it('reads brightness from dimmers', () => {
    const dimmer = { system: { get_sysinfo: { ...hs200Sysinfo.system.get_sysinfo, model: 'HS220(US)', relay_state: 0, brightness: 75 } } };
    expect(parseSysinfo('172.16.40.11', dimmer, seenAt)).toMatchObject({ on: false, brightness: 75 });
  });

  it('falls back to the model when the alias is blank', () => {
    const blank = { system: { get_sysinfo: { ...hs200Sysinfo.system.get_sysinfo, alias: '   ' } } };
    expect(parseSysinfo('172.16.40.25', blank, seenAt).alias).toBe('HS200(US)');
  });

  it.each([
    ['a reply without sysinfo', { system: {} }],
    ['a bulb', { system: { get_sysinfo: { mic_type: 'IOT.SMARTBULB', model: 'KL130' } } }],
    ['a power strip', { system: { get_sysinfo: { ...hs200Sysinfo.system.get_sysinfo, children: [{}] } } }],
  ])('rejects %s', (_, reply) => {
    expect(() => parseSysinfo('172.16.40.99', reply, seenAt)).toThrow();
  });
});

describe('validateStateChange', () => {
  it.each([
    [{ on: true }, { on: true }],
    [{ on: false }, { on: false }],
    [{ brightness: 50 }, { brightness: 50 }],
    [{ on: true, brightness: 1 }, { on: true, brightness: 1 }],
  ])('accepts %j', (body, expected) => {
    expect(validateStateChange(body)).toEqual(expected);
  });

  it.each([
    null,
    [],
    'on',
    {},
    { on: 'yes' },
    { brightness: 0 },
    { brightness: 101 },
    { brightness: 50.5 },
    { on: true, state: 1 },
  ])('rejects %j', (body) => {
    expect(() => validateStateChange(body)).toThrow();
  });
});

describe('buildStateCommands', () => {
  it('sets brightness before switching on', () => {
    expect(buildStateCommands({ on: true, brightness: 40 })).toEqual([
      { 'smartlife.iot.dimmer': { set_brightness: { brightness: 40 } } },
      { system: { set_relay_state: { state: 1 } } },
    ]);
  });

  it('switches off with state 0', () => {
    expect(buildStateCommands({ on: false })).toEqual([{ system: { set_relay_state: { state: 0 } } }]);
  });
});

describe('assertKasaOk', () => {
  it('accepts successful replies', () => {
    expect(() => assertKasaOk({ system: { set_relay_state: { err_code: 0 } } })).not.toThrow();
  });

  it('throws with the device error message', () => {
    expect(() => assertKasaOk({ 'smartlife.iot.dimmer': { set_brightness: { err_code: -1, err_msg: 'module not support' } } }))
      .toThrow(/set_brightness failed \(-1\): module not support/);
  });

  it('throws on an empty reply', () => {
    expect(() => assertKasaOk(null)).toThrow();
  });
});
