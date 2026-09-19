import {
  blockedAddressReason,
  isPublicUnicastAddress,
} from './ip-address-policy';

/**
 * Each denial this requirement names is asserted on its own, with the address
 * that makes it matter rather than a representative one where a real target
 * exists: 169.254.169.254 is the cloud metadata endpoint, 127.0.0.1:8200 is
 * where this deployment's Vault listens, and ml-service and object storage sit
 * in the private ranges.
 *
 * The cases that catch a careless implementation are the notation ones. A
 * check that pattern-matched the string "127." would pass ::ffff:127.0.0.1,
 * 2130706433 and 0177.0.0.1, all of which reach loopback.
 */

describe('loopback is refused, in every notation that reaches it', () => {
  it.each([
    '127.0.0.1',
    '127.0.0.53',
    '127.255.255.254',
    '::1',
  ])('refuses %s', (addr) => {
    expect(isPublicUnicastAddress(addr)).toBe(false);
  });

  it('refuses IPv4-mapped IPv6 loopback, which is loopback in other clothes', () => {
    expect(blockedAddressReason('::ffff:127.0.0.1')).toBe('ADDRESS_EMBEDS_BLOCKED_IPV4');
  });

  it('refuses the deprecated IPv4-compatible form', () => {
    expect(blockedAddressReason('::127.0.0.1')).toBe('ADDRESS_EMBEDS_BLOCKED_IPV4');
  });

  it('refuses octal and hex spellings rather than reinterpreting them', () => {
    // A resolver may read 0177.0.0.1 as loopback. This module refuses to give
    // the string a second reading at all.
    expect(isPublicUnicastAddress('0177.0.0.1')).toBe(false);
    expect(isPublicUnicastAddress('0x7f.0.0.1')).toBe(false);
    expect(isPublicUnicastAddress('2130706433')).toBe(false);
  });
});

describe('link-local is refused, including the cloud metadata address', () => {
  it('refuses 169.254.169.254', () => {
    expect(blockedAddressReason('169.254.169.254')).toBe('ADDRESS_LINK_LOCAL');
  });

  it.each(['169.254.0.1', '169.254.255.255'])('refuses %s', (addr) => {
    expect(blockedAddressReason(addr)).toBe('ADDRESS_LINK_LOCAL');
  });

  it('refuses IPv6 link-local, with and without a zone index', () => {
    expect(blockedAddressReason('fe80::1')).toBe('ADDRESS_LINK_LOCAL');
    expect(blockedAddressReason('fe80::1%eth0')).toBe('ADDRESS_LINK_LOCAL');
    expect(blockedAddressReason('febf::1')).toBe('ADDRESS_LINK_LOCAL');
  });

  it('refuses 6to4 and NAT64 forms that carry a link-local IPv4 inside', () => {
    expect(blockedAddressReason('2002:a9fe:a9fe::1')).toBe('ADDRESS_EMBEDS_BLOCKED_IPV4');
    expect(blockedAddressReason('64:ff9b::169.254.169.254')).toBe('ADDRESS_EMBEDS_BLOCKED_IPV4');
  });
});

describe('private and reserved ranges are refused', () => {
  it.each([
    ['10.0.0.1', 'ADDRESS_PRIVATE'],
    ['10.255.255.255', 'ADDRESS_PRIVATE'],
    ['172.16.0.1', 'ADDRESS_PRIVATE'],
    ['172.31.255.255', 'ADDRESS_PRIVATE'],
    ['192.168.1.1', 'ADDRESS_PRIVATE'],
    ['100.64.0.1', 'ADDRESS_SHARED_CGNAT'],
    ['0.0.0.0', 'ADDRESS_UNSPECIFIED'],
    ['224.0.0.1', 'ADDRESS_MULTICAST'],
    ['255.255.255.255', 'ADDRESS_RESERVED'],
    ['192.0.2.1', 'ADDRESS_DOCUMENTATION'],
    ['198.51.100.1', 'ADDRESS_DOCUMENTATION'],
    ['203.0.113.1', 'ADDRESS_DOCUMENTATION'],
    ['198.18.0.1', 'ADDRESS_BENCHMARKING'],
    ['192.88.99.1', 'ADDRESS_RESERVED'],
  ])('refuses %s as %s', (addr, reason) => {
    expect(blockedAddressReason(addr)).toBe(reason);
  });

  it('does not over-block the neighbours of a private range', () => {
    // 172.15 and 172.32 are public; only 172.16-172.31 is private. An
    // implementation that tested the first octet alone would block these.
    expect(isPublicUnicastAddress('172.15.0.1')).toBe(true);
    expect(isPublicUnicastAddress('172.32.0.1')).toBe(true);
    expect(isPublicUnicastAddress('11.0.0.1')).toBe(true);
    expect(isPublicUnicastAddress('100.63.255.255')).toBe(true);
    expect(isPublicUnicastAddress('100.128.0.1')).toBe(true);
    expect(isPublicUnicastAddress('192.169.0.1')).toBe(true);
  });

  it.each([
    ['fc00::1', 'ADDRESS_UNIQUE_LOCAL'],
    ['fd12:3456::1', 'ADDRESS_UNIQUE_LOCAL'],
    ['ff02::1', 'ADDRESS_MULTICAST'],
    ['::', 'ADDRESS_UNSPECIFIED'],
    ['2001:db8::1', 'ADDRESS_DOCUMENTATION'],
    ['100::1', 'ADDRESS_RESERVED'],
  ])('refuses IPv6 %s as %s', (addr, reason) => {
    expect(blockedAddressReason(addr)).toBe(reason);
  });

  it('refuses IPv4-mapped IPv6 carrying a private address', () => {
    expect(blockedAddressReason('::ffff:10.0.0.1')).toBe('ADDRESS_EMBEDS_BLOCKED_IPV4');
    expect(blockedAddressReason('::ffff:192.168.1.1')).toBe('ADDRESS_EMBEDS_BLOCKED_IPV4');
  });
});

describe('public unicast addresses are allowed, or the control is useless', () => {
  it.each([
    '1.1.1.1',
    '8.8.8.8',
    '93.184.216.34',
    '2606:4700:4700::1111',
    '2a00:1450:4001:80e::200e',
    '::ffff:8.8.8.8',
  ])('allows %s', (addr) => {
    expect(isPublicUnicastAddress(addr)).toBe(true);
  });
});

describe('anything that is not an address is refused rather than guessed at', () => {
  it.each(['', 'example.test', '999.1.1.1', '1.2.3', '1.2.3.4.5', 'not-an-ip', '::gggg'])(
    'refuses %p',
    (value) => {
      expect(blockedAddressReason(value)).toMatch(/^ADDRESS_/u);
      expect(isPublicUnicastAddress(value)).toBe(false);
    },
  );
});
