import { Injectable } from '@nestjs/common';
import { isIP } from 'net';
import type { Request } from 'express';

export type TrustedProxyMode = 'direct' | 'cidr';

type ParsedAddress = Readonly<{
  family: 4 | 6;
  value: bigint;
  bits: 32 | 128;
}>;

type ParsedCidr = ParsedAddress & Readonly<{
  prefix: number;
  mask: bigint;
}>;

export type TrustedProxyPolicy = Readonly<{
  mode: TrustedProxyMode;
  cidrs: readonly string[];
  trust: (ip: string) => boolean;
  resolve: (remoteAddress: string | undefined, forwardedFor: string | string[] | undefined) => string;
  expressSetting: false | ((ip: string) => boolean);
}>;

const MAX_FORWARDED_HEADER_LENGTH = 4096;
const MAX_PROXY_HOPS = 20;

function normalizeIp(value: string | undefined): string | null {
  if (!value) return null;
  let candidate = value.trim();
  if (!candidate) return null;
  if (candidate.startsWith('[') && candidate.includes(']')) {
    candidate = candidate.slice(1, candidate.indexOf(']'));
  }
  const zoneIndex = candidate.indexOf('%');
  if (zoneIndex >= 0) candidate = candidate.slice(0, zoneIndex);
  if (candidate.toLowerCase().startsWith('::ffff:')) {
    const mapped = candidate.slice(7);
    if (isIP(mapped) === 4) return mapped;
  }
  return isIP(candidate) ? candidate.toLowerCase() : null;
}

function parseIpv4(value: string): bigint | null {
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  let result = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    result = (result << 8n) | BigInt(octet);
  }
  return result;
}

function parseIpv6(value: string): bigint | null {
  let candidate = value.toLowerCase();
  if (candidate.includes('.')) {
    const lastColon = candidate.lastIndexOf(':');
    if (lastColon < 0) return null;
    const ipv4 = parseIpv4(candidate.slice(lastColon + 1));
    if (ipv4 === null) return null;
    candidate = `${candidate.slice(0, lastColon)}:${Number((ipv4 >> 16n) & 0xffffn).toString(16)}:${Number(ipv4 & 0xffffn).toString(16)}`;
  }

  const doubleColon = candidate.indexOf('::');
  if (doubleColon !== candidate.lastIndexOf('::')) return null;
  const left = doubleColon >= 0 ? candidate.slice(0, doubleColon).split(':').filter(Boolean) : candidate.split(':');
  const right = doubleColon >= 0 ? candidate.slice(doubleColon + 2).split(':').filter(Boolean) : [];
  const missing = 8 - left.length - right.length;
  if ((doubleColon < 0 && missing !== 0) || (doubleColon >= 0 && missing < 1)) return null;
  const groups = [...left, ...Array(Math.max(0, missing)).fill('0'), ...right];
  if (groups.length !== 8) return null;

  let result = 0n;
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    result = (result << 16n) | BigInt(Number.parseInt(group, 16));
  }
  return result;
}

function parseAddress(value: string): ParsedAddress | null {
  const normalized = normalizeIp(value);
  if (!normalized) return null;
  if (isIP(normalized) === 4) {
    const parsed = parseIpv4(normalized);
    return parsed === null ? null : { family: 4, value: parsed, bits: 32 };
  }
  const parsed = parseIpv6(normalized);
  return parsed === null ? null : { family: 6, value: parsed, bits: 128 };
}

function parseCidr(value: string): ParsedCidr {
  const [addressPart, prefixPart, extra] = value.trim().split('/');
  if (!addressPart || extra !== undefined) throw new Error(`Invalid trusted proxy CIDR: ${value}`);
  const address = parseAddress(addressPart);
  if (!address) throw new Error(`Invalid trusted proxy address: ${value}`);
  const prefix = prefixPart === undefined ? address.bits : Number(prefixPart);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > address.bits) {
    throw new Error(`Invalid trusted proxy prefix: ${value}`);
  }
  const hostBits = BigInt(address.bits - prefix);
  const fullMask = (1n << BigInt(address.bits)) - 1n;
  const mask = prefix === 0 ? 0n : fullMask ^ ((1n << hostBits) - 1n);
  return { ...address, prefix, mask, value: address.value & mask };
}

function cidrContains(cidr: ParsedCidr, ip: string): boolean {
  const address = parseAddress(ip);
  return !!address && address.family === cidr.family && (address.value & cidr.mask) === cidr.value;
}

function forwardedValues(value: string | string[] | undefined): string[] | null {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join(',') : value;
  if (raw.length > MAX_FORWARDED_HEADER_LENGTH) return null;
  const values = raw.split(',').map((part) => normalizeIp(part));
  if (values.length > MAX_PROXY_HOPS || values.some((part) => !part)) return null;
  return values as string[];
}

export function createTrustedProxyPolicy(env: NodeJS.ProcessEnv = process.env): TrustedProxyPolicy {
  const production = String(env.NODE_ENV ?? '').toLowerCase() === 'production';
  const rawMode = String(env.TRUST_PROXY_MODE ?? (production ? '' : 'direct')).trim().toLowerCase();
  if (rawMode !== 'direct' && rawMode !== 'cidr') {
    throw new Error('TRUST_PROXY_MODE must be explicitly set to direct or cidr in production.');
  }
  const mode = rawMode as TrustedProxyMode;
  const cidrValues = String(env.TRUSTED_PROXY_CIDRS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (mode === 'cidr' && cidrValues.length === 0) {
    throw new Error('TRUSTED_PROXY_CIDRS is required when TRUST_PROXY_MODE=cidr.');
  }
  const parsedCidrs = cidrValues.map(parseCidr);
  const trust = (ip: string) => mode === 'cidr' && parsedCidrs.some((cidr) => cidrContains(cidr, ip));

  const resolve = (
    remoteAddress: string | undefined,
    forwardedFor: string | string[] | undefined,
  ): string => {
    const remote = normalizeIp(remoteAddress) ?? 'unknown';
    if (mode === 'direct' || remote === 'unknown' || !trust(remote)) return remote;
    const forwarded = forwardedValues(forwardedFor);
    if (!forwarded || forwarded.length === 0) return remote;
    const chain = [...forwarded, remote];
    let index = chain.length - 1;
    while (index > 0 && trust(chain[index])) index -= 1;
    return chain[index];
  };

  return Object.freeze({
    mode,
    cidrs: Object.freeze([...cidrValues]),
    trust,
    resolve,
    expressSetting: mode === 'direct' ? false : (ip: string) => trust(ip),
  });
}

@Injectable()
export class TrustedProxyService {
  readonly policy = createTrustedProxyPolicy();

  resolveRequestIp(request: Pick<Request, 'socket' | 'headers'>): string {
    const forwarded = request.headers['x-forwarded-for'];
    return this.policy.resolve(request.socket?.remoteAddress, forwarded);
  }
}
