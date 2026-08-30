import { isIP } from 'node:net';

/**
 * Which IP addresses an untrusted destination is allowed to resolve to.
 *
 * ASVS 5.0 V1.3.6 asks that untrusted data be validated against an allowlist
 * of protocols, domains, paths and ports before it is used to call another
 * service. Checking the scheme - V1.2.2, already done - proves the URL is of a
 * safe kind. It proves nothing about where it points: `http://127.0.0.1:8200`
 * and `http://169.254.169.254/latest/meta-data/` are both perfectly valid http
 * URLs, and both are the whole point of an SSRF attack.
 *
 * This module answers one question and nothing else: is this literal IP
 * address a public unicast address that an untrusted caller may direct us to?
 * It performs no DNS resolution and no I/O, so every range below is decidable
 * and testable on its own.
 *
 * It is deliberately NOT applied to operator-configured destinations. The ML
 * service, Vault and object storage are reached at internal names that resolve
 * into private space by design; a blanket policy over every outbound call
 * would break them while protecting nothing, because the operator already
 * chose those addresses. The guard belongs on the path where the destination
 * comes from outside.
 */

export type BlockedAddressReason =
  | 'ADDRESS_UNPARSEABLE'
  | 'ADDRESS_UNSPECIFIED'
  | 'ADDRESS_LOOPBACK'
  | 'ADDRESS_PRIVATE'
  | 'ADDRESS_LINK_LOCAL'
  | 'ADDRESS_SHARED_CGNAT'
  | 'ADDRESS_MULTICAST'
  | 'ADDRESS_RESERVED'
  | 'ADDRESS_DOCUMENTATION'
  | 'ADDRESS_BENCHMARKING'
  | 'ADDRESS_UNIQUE_LOCAL'
  | 'ADDRESS_EMBEDS_BLOCKED_IPV4';

function ipv4Octets(value: string): number[] | null {
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    // Reject anything not in plain decimal form. 0177.0.0.1 and 0x7f.0.0.1 are
    // read as loopback by some resolvers and as nonsense by a naive parser, so
    // they are refused here rather than being given a second interpretation.
    if (!/^\d{1,3}$/u.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    octets.push(n);
  }
  return octets;
}

/** Classifies a literal IPv4 address. Returns null when it is public unicast. */
export function blockedIpv4Reason(value: string): BlockedAddressReason | null {
  const o = ipv4Octets(value);
  if (!o) return 'ADDRESS_UNPARSEABLE';
  const [a, b] = o;

  if (a === 0) return 'ADDRESS_UNSPECIFIED';           // 0.0.0.0/8
  if (a === 127) return 'ADDRESS_LOOPBACK';            // 127.0.0.0/8
  if (a === 10) return 'ADDRESS_PRIVATE';              // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return 'ADDRESS_PRIVATE';   // 172.16.0.0/12
  if (a === 192 && b === 168) return 'ADDRESS_PRIVATE';            // 192.168.0.0/16
  if (a === 169 && b === 254) return 'ADDRESS_LINK_LOCAL';         // 169.254.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return 'ADDRESS_SHARED_CGNAT'; // 100.64.0.0/10
  if (a === 192 && b === 0 && o[2] === 0) return 'ADDRESS_RESERVED';   // 192.0.0.0/24
  if (a === 192 && b === 0 && o[2] === 2) return 'ADDRESS_DOCUMENTATION';    // TEST-NET-1
  if (a === 198 && b === 51 && o[2] === 100) return 'ADDRESS_DOCUMENTATION'; // TEST-NET-2
  if (a === 203 && b === 0 && o[2] === 113) return 'ADDRESS_DOCUMENTATION';  // TEST-NET-3
  if (a === 192 && b === 88 && o[2] === 99) return 'ADDRESS_RESERVED';       // 6to4 relay anycast
  if (a === 198 && (b === 18 || b === 19)) return 'ADDRESS_BENCHMARKING';    // 198.18.0.0/15
  if (a >= 224 && a <= 239) return 'ADDRESS_MULTICAST';  // 224.0.0.0/4
  if (a >= 240) return 'ADDRESS_RESERVED';               // 240.0.0.0/4, incl. broadcast

  return null;
}

/** Expands an IPv6 literal to its sixteen bytes, or null when unparseable. */
function ipv6Bytes(value: string): number[] | null {
  let text = value;
  // A zone index (fe80::1%eth0) is not part of the address.
  const zone = text.indexOf('%');
  if (zone !== -1) text = text.slice(0, zone);

  let embeddedV4: number[] | null = null;
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    embeddedV4 = ipv4Octets(tail);
    if (!embeddedV4) return null;
    text = text.slice(0, lastColon + 1) + '0:0';
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;

  const parseGroups = (part: string): number[] | null => {
    if (part === '') return [];
    const groups: number[] = [];
    for (const g of part.split(':')) {
      if (!/^[0-9a-fA-F]{1,4}$/u.test(g)) return null;
      groups.push(parseInt(g, 16));
    }
    return groups;
  };

  const head = parseGroups(halves[0]);
  if (!head) return null;
  let groups: number[];

  if (halves.length === 2) {
    const rest = parseGroups(halves[1]);
    if (!rest) return null;
    const missing = 8 - head.length - rest.length;
    if (missing < 0) return null;
    groups = [...head, ...new Array<number>(missing).fill(0), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const g of groups) bytes.push((g >> 8) & 0xff, g & 0xff);
  if (embeddedV4) {
    bytes[12] = embeddedV4[0];
    bytes[13] = embeddedV4[1];
    bytes[14] = embeddedV4[2];
    bytes[15] = embeddedV4[3];
  }
  return bytes;
}

const dotted = (bytes: number[], from: number): string =>
  bytes.slice(from, from + 4).join('.');

/**
 * Classifies a literal IPv6 address. Returns null when it is public unicast.
 *
 * The traps that matter here are the forms that carry an IPv4 address inside
 * an IPv6 one. `::ffff:127.0.0.1` is loopback wearing a different notation,
 * and a check that only pattern-matched IPv6 prefixes would wave it through.
 * Every embedding form is unwrapped and the IPv4 rules applied to what is
 * inside.
 */
export function blockedIpv6Reason(value: string): BlockedAddressReason | null {
  const b = ipv6Bytes(value);
  if (!b) return 'ADDRESS_UNPARSEABLE';

  const allZero = b.every((x) => x === 0);
  if (allZero) return 'ADDRESS_UNSPECIFIED';                      // ::
  if (b.slice(0, 15).every((x) => x === 0) && b[15] === 1) return 'ADDRESS_LOOPBACK'; // ::1

  // ::ffff:a.b.c.d - IPv4-mapped.
  if (b.slice(0, 10).every((x) => x === 0) && b[10] === 0xff && b[11] === 0xff) {
    return blockedIpv4Reason(dotted(b, 12)) ? 'ADDRESS_EMBEDS_BLOCKED_IPV4' : null;
  }
  // ::a.b.c.d - deprecated IPv4-compatible.
  if (b.slice(0, 12).every((x) => x === 0)) {
    return blockedIpv4Reason(dotted(b, 12)) ? 'ADDRESS_EMBEDS_BLOCKED_IPV4' : null;
  }
  // 2002:V4::/16 - 6to4 carries the IPv4 address in bytes 2..5.
  if (b[0] === 0x20 && b[1] === 0x02) {
    return blockedIpv4Reason(dotted(b, 2)) ? 'ADDRESS_EMBEDS_BLOCKED_IPV4' : null;
  }
  // 64:ff9b::/96 and 64:ff9b:1::/48 - NAT64 carries IPv4 in the last four bytes.
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) {
    return blockedIpv4Reason(dotted(b, 12)) ? 'ADDRESS_EMBEDS_BLOCKED_IPV4' : null;
  }
  // 2001:0000::/32 - Teredo. The server address sits in bytes 4..7.
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00) {
    return blockedIpv4Reason(dotted(b, 4)) ? 'ADDRESS_EMBEDS_BLOCKED_IPV4' : 'ADDRESS_RESERVED';
  }

  if ((b[0] & 0xfe) === 0xfc) return 'ADDRESS_UNIQUE_LOCAL';       // fc00::/7
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return 'ADDRESS_LINK_LOCAL'; // fe80::/10
  if (b[0] === 0xff) return 'ADDRESS_MULTICAST';                    // ff00::/8
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) {
    return 'ADDRESS_DOCUMENTATION';                                 // 2001:db8::/32
  }
  if (b[0] === 0x01 && b.slice(1, 8).every((x) => x === 0)) {
    return 'ADDRESS_RESERVED';                                      // 100::/64 discard
  }

  return null;
}

/**
 * The single entry point: why this literal address may not be reached, or null
 * when it may. Anything that is not a recognisable IP is refused rather than
 * guessed at - fail closed is the whole posture here.
 */
export function blockedAddressReason(value: string): BlockedAddressReason | null {
  const family = isIP(value);
  if (family === 4) return blockedIpv4Reason(value);
  if (family === 6) return blockedIpv6Reason(value);

  // isIP rejects a zone index, which is legitimate syntax for a link-local
  // address, and a link-local address is one we block anyway.
  if (value.includes('%') && isIP(value.split('%')[0]) === 6) {
    return blockedIpv6Reason(value);
  }
  return 'ADDRESS_UNPARSEABLE';
}

/** True when an untrusted destination may resolve to this address. */
export function isPublicUnicastAddress(value: string): boolean {
  return blockedAddressReason(value) === null;
}
