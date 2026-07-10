import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  mapApiRoleToCabinetRole,
  verifyHs256Jwt,
  readVerifiedCabinetRole,
  signCabinetSession,
  readVerifiedCabinetSessionRole,
} from '@/lib/platform-v7/verified-session';
import { resolveServerCabinetAccess } from '@/lib/platform-v7/server-cabinet-access';

const SECRET = 'test-secret-4c-pre';
const NOW = 1_900_000_000;

function b64url(input: string): string {
  return Buffer.from(input).toString('base64url');
}

function mintJwt(payload: Record<string, unknown>, secret = SECRET): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

describe('mapApiRoleToCabinetRole', () => {
  it('maps every current operational API role to the correct cabinet', () => {
    expect(mapApiRoleToCabinetRole('BUYER')).toBe('buyer');
    expect(mapApiRoleToCabinetRole('FARMER')).toBe('seller');
    expect(mapApiRoleToCabinetRole('SUPPORT_MANAGER')).toBe('operator');
    expect(mapApiRoleToCabinetRole('ACCOUNTING')).toBe('bank');
    expect(mapApiRoleToCabinetRole('COMPLIANCE_OFFICER')).toBe('compliance');
    expect(mapApiRoleToCabinetRole('ARBITRATOR')).toBe('arbitrator');
    expect(mapApiRoleToCabinetRole('SURVEYOR')).toBe('surveyor');
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
    const good = mintJwt({ role: 'BUYER', exp: NOW + 3600 });
    const [h, , s] = good.split('.');
    const tampered = `${h}.${b64url(JSON.stringify({ role: 'bank', exp: NOW + 3600 }))}.${s}`;
    expect(await verifyHs256Jwt(tampered, SECRET)).toBeNull();
  });
});

describe('readVerifiedCabinetRole', () => {
  it('accepts verified JWT roles including oversight cabinets', async () => {
    expect(await readVerifiedCabinetRole(mintJwt({ role: 'BANK_OFFICER' }), SECRET, NOW)).toBeNull();
    expect(await readVerifiedCabinetRole(mintJwt({ role: 'BUYER', exp: NOW + 3600 }), SECRET, NOW)).toBe('buyer');
    expect(await readVerifiedCabinetRole(mintJwt({ role: 'EXECUTIVE', exp: NOW + 3600 }), SECRET, NOW)).toBe('executive');
    expect(await readVerifiedCabinetRole(mintJwt({ role: 'ACCOUNTING', exp: NOW + 3600 }), SECRET, NOW)).toBe('bank');
    expect(await readVerifiedCabinetRole(mintJwt({ role: 'COMPLIANCE_OFFICER', exp: NOW + 3600 }), SECRET, NOW)).toBe('compliance');
    expect(await readVerifiedCabinetRole(mintJwt({ role: 'ARBITRATOR', exp: NOW + 3600 }), SECRET, NOW)).toBe('arbitrator');
  });

  it('ignores URL-style role spoofing — only the token is read', async () => {
    const verifiedRole = await readVerifiedCabinetRole(mintJwt({ role: 'BUYER', exp: NOW + 3600 }), SECRET, NOW);
    expect(verifiedRole).toBe('buyer');
    expect(resolveServerCabinetAccess({ pathname: '/platform-v7/bank', verifiedRole, mode: 'report' }).status).toBe('would-deny');
  });

  it('rejects a raw/spoofed role string', async () => {
    expect(await readVerifiedCabinetRole('bank', SECRET, NOW)).toBeNull();
    expect(await readVerifiedCabinetRole('pc-role=bank', SECRET, NOW)).toBeNull();
    expect(await readVerifiedCabinetRole('demo.' + b64url(JSON.stringify({ role: 'BANK' })), SECRET, NOW)).toBeNull();
  });

  it('returns null for unverified, expired or missing sessions', async () => {
    expect(await readVerifiedCabinetRole(null, SECRET, NOW)).toBeNull();
    expect(await readVerifiedCabinetRole(undefined, SECRET, NOW)).toBeNull();
    expect(await readVerifiedCabinetRole(mintJwt({ role: 'BUYER', exp: NOW - 10 }), SECRET, NOW)).toBeNull();
    const result = resolveServerCabinetAccess({ pathname: '/platform-v7/bank', verifiedRole: null, mode: 'report' });
    expect(result.status).toBe('unknown');
    expect(result.enforced).toBe(false);
  });
});

describe('dedicated cabinet session', () => {
  it('signs a cabinet session that verifies back to the same cabinet role', async () => {
    for (const role of ['bank', 'surveyor', 'arbitrator', 'compliance', 'seller', 'operator'] as const) {
      const token = await signCabinetSession(role, SECRET, { nowSeconds: NOW, ttlSeconds: 3600 });
      expect(token).toBeTruthy();
      expect(await readVerifiedCabinetSessionRole(token, SECRET, NOW)).toBe(role);
    }
  });

  it('refuses an unknown role or missing secret', async () => {
    expect(await signCabinetSession('hacker', SECRET, { nowSeconds: NOW, ttlSeconds: 3600 })).toBeNull();
    expect(await signCabinetSession('bank', '', { nowSeconds: NOW, ttlSeconds: 3600 })).toBeNull();
  });

  it('rejects wrong secret, expired, tampered and demo tokens', async () => {
    const token = await signCabinetSession('bank', SECRET, { nowSeconds: NOW, ttlSeconds: 3600 });
    expect(await readVerifiedCabinetSessionRole(token, 'wrong-secret', NOW)).toBeNull();
    const expired = await signCabinetSession('bank', SECRET, { nowSeconds: NOW - 7200, ttlSeconds: 3600 });
    expect(await readVerifiedCabinetSessionRole(expired, SECRET, NOW)).toBeNull();
    expect(await readVerifiedCabinetSessionRole('demo.' + b64url(JSON.stringify({ cab: 'bank' })), SECRET, NOW)).toBeNull();
    expect(await readVerifiedCabinetSessionRole(null, SECRET, NOW)).toBeNull();
  });

  it('ignores an API-role JWT because this resolver trusts only the cab claim', async () => {
    expect(await readVerifiedCabinetSessionRole(mintJwt({ role: 'BUYER', exp: NOW + 3600 }), SECRET, NOW)).toBeNull();
  });
});
