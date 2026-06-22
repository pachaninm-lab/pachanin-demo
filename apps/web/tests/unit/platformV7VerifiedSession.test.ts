import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  mapApiRoleToCabinetRole,
  verifyHs256Jwt,
  readVerifiedCabinetRole,
} from '@/lib/platform-v7/verified-session';
import { resolveServerCabinetAccess } from '@/lib/platform-v7/server-cabinet-access';

// Phase 4C-pre — the server cabinet role must come ONLY from a cryptographically
// verified HS256 JWT. URL/query/pc-role/client-guard/demo tokens are not authority;
// anything unverified resolves to null → unknown → never blocked (report-only).

const SECRET = 'test-secret-4c-pre';
const NOW = 1_900_000_000; // fixed "now" in seconds

function b64url(input: string): string {
  return Buffer.from(input).toString('base64url');
}

/** Mint a real HS256 JWT the way the API's jwt.sign would. */
function mintJwt(payload: Record<string, unknown>, secret = SECRET): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

describe('mapApiRoleToCabinetRole', () => {
  it('maps known API roles to cabinet roles and leaves the rest unknown', () => {
    expect(mapApiRoleToCabinetRole('BUYER')).toBe('buyer');
    expect(mapApiRoleToCabinetRole('FARMER')).toBe('seller');
    expect(mapApiRoleToCabinetRole('SUPPORT_MANAGER')).toBe('operator');
    expect(mapApiRoleToCabinetRole('ACCOUNTING')).toBeNull(); // no 1:1 cabinet
    expect(mapApiRoleToCabinetRole('GUEST')).toBeNull();
    expect(mapApiRoleToCabinetRole('nonsense')).toBeNull();
    expect(mapApiRoleToCabinetRole(undefined)).toBeNull();
  });
});

describe('verifyHs256Jwt', () => {
  it('accepts a correctly signed token and returns its claims', async () => {
    const claims = await verifyHs256Jwt(mintJwt({ role: 'BUYER', exp: NOW + 3600 }), SECRET);
    expect(claims?.role).toBe('BUYER');
  });

  it('rejects a demo/fake token, wrong secret, tamper, and malformed tokens', async () => {
    expect(await verifyHs256Jwt('demo.' + b64url(JSON.stringify({ role: 'BUYER' })), SECRET)).toBeNull();
    expect(await verifyHs256Jwt(mintJwt({ role: 'BUYER' }), 'wrong-secret')).toBeNull();
    expect(await verifyHs256Jwt('not.a.jwt', SECRET)).toBeNull();
    expect(await verifyHs256Jwt('only-one-segment', SECRET)).toBeNull();
    // tampered payload, original signature
    const good = mintJwt({ role: 'BUYER', exp: NOW + 3600 });
    const [h, , s] = good.split('.');
    const tampered = `${h}.${b64url(JSON.stringify({ role: 'bank', exp: NOW + 3600 }))}.${s}`;
    expect(await verifyHs256Jwt(tampered, SECRET)).toBeNull();
  });
});

describe('readVerifiedCabinetRole', () => {
  it('1. accepts a verified JWT role', async () => {
    expect(await readVerifiedCabinetRole(mintJwt({ role: 'BANK_OFFICER' }), SECRET, NOW)).toBeNull(); // unmapped API role
    expect(await readVerifiedCabinetRole(mintJwt({ role: 'BUYER', exp: NOW + 3600 }), SECRET, NOW)).toBe('buyer');
    expect(await readVerifiedCabinetRole(mintJwt({ role: 'EXECUTIVE', exp: NOW + 3600 }), SECRET, NOW)).toBe('executive');
  });

  it('2. ignores URL-style role spoofing — only the token is read (no path/query input exists)', async () => {
    // A verified BUYER token stays buyer no matter the path; the resolver decides access.
    const verifiedRole = await readVerifiedCabinetRole(mintJwt({ role: 'BUYER', exp: NOW + 3600 }), SECRET, NOW);
    expect(verifiedRole).toBe('buyer');
    expect(resolveServerCabinetAccess({ pathname: '/platform-v7/bank', verifiedRole, mode: 'report' }).status).toBe('would-deny');
  });

  it('3. a raw/spoofed role string is NOT a verified token → null', async () => {
    expect(await readVerifiedCabinetRole('bank', SECRET, NOW)).toBeNull();
    expect(await readVerifiedCabinetRole('pc-role=bank', SECRET, NOW)).toBeNull();
    expect(await readVerifiedCabinetRole('demo.' + b64url(JSON.stringify({ role: 'BANK' })), SECRET, NOW)).toBeNull();
  });

  it('4. unverified/expired/missing session → null (never blocks in report-only)', async () => {
    expect(await readVerifiedCabinetRole(null, SECRET, NOW)).toBeNull();
    expect(await readVerifiedCabinetRole(undefined, SECRET, NOW)).toBeNull();
    expect(await readVerifiedCabinetRole(mintJwt({ role: 'BUYER', exp: NOW - 10 }), SECRET, NOW)).toBeNull(); // expired
    // the resolver treats null as unknown, never enforced
    const r = resolveServerCabinetAccess({ pathname: '/platform-v7/bank', verifiedRole: null, mode: 'report' });
    expect(r.status).toBe('unknown');
    expect(r.enforced).toBe(false);
  });
});
