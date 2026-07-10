import { isIP } from 'net';
import type { Request } from 'express';

export type TrustedCidr = Readonly<{
  version: 4 | 6;
  network: bigint;
  prefix: number;
  original: string;
}>;

export function parseTrustedProxyCidrs(raw = process.env.TRUSTED_PROXY_CIDRS ?? ''): TrustedCidr[] {
  const values = raw.split(',').map((item) => item.trim()).filter(Boolean);
  return values.map(parseCidr);
}

export function buildTrustedProxyPredicate(
  raw = process.env.TRUSTED_PROXY_CIDRS ?? '',
  production = String(process.env.NODE_ENV ?? '').toLowerCase() === 'production',
): (address: string) => boolean {
  const cidrs = parseTrustedProxyCidrs(raw);
  if (production && cidrs.some((cidr) => cidr.prefix === 0)) {
    throw new Error('Trust-all proxy CIDRs are forbidden in production.');
  }
  return (address: string) => isAddressTrusted(address, cidrs);
}

export function resolveClientAddress(
  req: Pick<Request, 'headers' | 'socket' | 'ip'>,
  trustedCidrs: readonly TrustedCidr[],
): string {
  const direct = normalizeIp(req.socket?.remoteAddress ?? req.ip ?? '');
  if (!direct) return 'unknown';
  if (!isAddressTrusted(direct, trustedCidrs)) return direct;

  const forwarded = forwardedAddresses(req.headers?.['x-forwarded-for']);
  let candidate = direct;
  for (let index = forwarded.length - 1; index >= 0; index -= 1) {
    if (!isAddressTrusted(candidate, trustedCidrs)) break;
    candidate = forwarded[index];
  }
  return candidate;
}

export function isAddressTrusted(address: string, cidrs: readonly TrustedCidr[]): boolean {
  const normalized = normalizeIp(address);
  if (!normalized) return false;
  const version = isIP(normalized);
  if (version !== 4 && version !== 6) return false;
  const value = ipToBigInt(normalized, version);
  return cidrs.some((cidr) => cidr.version === version && mask(value, version, cidr.prefix) === cidr.network);
}

export function normalizeIp(value: string): string {
  let input = String(value ?? '').trim();
  if (!input) return '';
  if (input.startsWith('[') && input.includes(']')) input = input.slice(1, input.indexOf(']'));
  const zoneIndex = input.indexOf('%');
  if (zoneIndex >= 0) input = input.slice(0, zoneIndex);
  if (input.toLowerCase().startsWith('::ffff:')) {
    const mapped = input.slice(7);
    if (isIP(mapped) === 4) return mapped;
  }
  return isIP(input) ? input.toLowerCase() : '';
}

function forwardedAddresses(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(',') : String(value ?? '');
  return raw
    .split(',')
    .map((item) => normalizeIp(item))
    .filter(Boolean)
    .slice(-32);
}

function parseCidr(value: string): TrustedCidr {
  const [rawAddress, rawPrefix] = value.split('/');
  const address = normalizeIp(rawAddress);
  const version = isIP(address);
  if (version !== 4 && version !== 6) throw new Error(`Invalid trusted proxy CIDR: ${value}`);
  const maxBits = version === 4 ? 32 : 128;
  const prefix = rawPrefix === undefined ? maxBits : Number(rawPrefix);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxBits) {
    throw new Error(`Invalid trusted proxy CIDR prefix: ${value}`);
  }
  const numeric = ipToBigInt(address, version);
  return Object.freeze({
    version,
    network: mask(numeric, version, prefix),
    prefix,
    original: value,
  });
}

function mask(value: bigint, version: 4 | 6, prefix: number): bigint {
  const bits = version === 4 ? 32 : 128;
  if (prefix === 0) return 0n;
  const shift = BigInt(bits - prefix);
  return (value >> shift) << shift;
}

function ipToBigInt(address: string, version: 4 | 6): bigint {
  if (version === 4) {
    return address.split('.').reduce((result, part) => (result << 8n) + BigInt(Number(part)), 0n);
  }
  const groups = expandIpv6(address);
  return groups.reduce((result, group) => (result << 16n) + BigInt(Number.parseInt(group, 16)), 0n);
}

function expandIpv6(address: string): string[] {
  let input = address;
  const ipv4Match = input.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Match) {
    const ipv4 = ipv4Match[1];
    const value = ipToBigInt(ipv4, 4);
    const high = Number((value >> 16n) & 0xffffn).toString(16);
    const low = Number(value & 0xffffn).toString(16);
    input = `${input.slice(0, -ipv4.length)}${high}:${low}`;
  }
  const [leftRaw, rightRaw] = input.split('::');
  const left = leftRaw ? leftRaw.split(':').filter(Boolean) : [];
  const right = rightRaw ? rightRaw.split(':').filter(Boolean) : [];
  if (!input.includes('::') && left.length !== 8) throw new Error(`Invalid IPv6 address: ${address}`);
  const missing = 8 - left.length - right.length;
  if (missing < 0) throw new Error(`Invalid IPv6 address: ${address}`);
  return [...left, ...Array.from({ length: missing }, () => '0'), ...right]
    .map((group) => group.padStart(4, '0'));
}
