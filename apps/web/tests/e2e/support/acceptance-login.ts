import { createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * Real login for the Design System v8 acceptance matrix.
 *
 * The platform layout only trusts a cabinet session whose user, membership,
 * organization and tenant match a live /auth/me profile, so a hand-minted
 * cookie cannot open a cabinet and should not be able to. This helper drives
 * the ordinary login route instead: the server verifies the password against
 * PostgreSQL and mints both the session and the
 * cabinet cookie through the same code production runs.
 *
 * Nothing here weakens the boundary. The only test-supplied inputs are a
 * seeded account's own credentials.
 */

export const ACCEPTANCE_PASSWORD = 'Acceptance!Passw0rd-v8';

/**
 * Public TOTP fixture material for the original pre-enrolled identities and
 * isolated READY bank journey. Fresh role subjects enroll a newly generated
 * secret through the real authenticated server endpoints.
 */
export const ACCEPTANCE_TOTP_SECRET = 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU';

export type CabinetRole =
  | 'operator' | 'buyer' | 'seller' | 'logistics' | 'driver' | 'surveyor'
  | 'elevator' | 'lab' | 'bank' | 'arbitrator' | 'compliance' | 'executive';

export function acceptanceEmail(role: CabinetRole): string {
  return `dsv8.${role}@acceptance.invalid`;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const character of clean) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

/** RFC 6238 TOTP, matching the API's SHA1/6-digit/30-second parameters. */
export function totp(secret: string, unixMs = Date.now()): string {
  const counter = Math.floor(unixMs / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);
  const digest = createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

async function csrfToken(context: BrowserContext, baseURL: string): Promise<string> {
  const cookies = await context.cookies(baseURL);
  const token = cookies.find((cookie) => cookie.name === 'pc_csrf_token')?.value;
  expect(token, 'middleware must issue a CSRF token before login').toBeTruthy();
  return token as string;
}

/** Each scenario gets its own disposable subject under the existing seeded
 * membership authority. The server allows five MFA starts per user in 300
 * seconds. Different browser scenarios must not share that user's allowance.
 * No session or assurance is
 * seeded: password login and TOTP still run through the real server endpoints.
 */
async function isolatedAcceptanceEmail(role: CabinetRole, baseURL: string): Promise<string> {
  const database = new URL(String(process.env.DATABASE_URL || ''));
  const browserTarget = new URL(baseURL);
  if (browserTarget.protocol !== 'https:'
    || !['localhost', '127.0.0.1'].includes(browserTarget.hostname)
    || !['postgres:', 'postgresql:'].includes(database.protocol)
    || !['localhost', '127.0.0.1', 'postgres'].includes(database.hostname)
    || database.pathname !== '/dsv8_acceptance') {
    throw new Error('Isolated role fixtures require the localhost TLS/disposable dsv8_acceptance matrix');
  }
  const apiRequire = createRequire(resolve(process.cwd(), '../api/package.json'));
  const { PrismaClient } = apiRequire('@prisma/client');
  const prisma = new PrismaClient();
  const email = `dsv8.${role}.${randomUUID()}@acceptance.invalid`;
  try {
    return await prisma.$transaction(async (tx: typeof prisma) => {
      const template = await tx.user.findUnique({ where: { email: acceptanceEmail(role) } });
      expect(template?.status, 'existing activated seed identity').toBe('ACTIVE');
      expect(template?.passwordHash, 'existing seeded password credential').toBeTruthy();
      const memberships = await tx.userOrg.findMany({
        where: { userId: template.id, isDefault: true, status: 'ACTIVE' },
        include: { organization: true },
      });
      expect(memberships, 'exactly one existing default role membership').toHaveLength(1);
      const membership = memberships[0];
      expect(membership.organization.status, 'existing verified seed organization').toBe('VERIFIED');
      expect(membership.isOrgAdmin, 'original fixture has no organization-admin grant').toBe(false);
      const user = await tx.user.create({ data: {
        email, passwordHash: template.passwordHash, fullName: template.fullName, status: 'ACTIVE',
      } });
      await tx.userOrg.create({ data: {
        userId: user.id, organizationId: membership.organizationId, role: membership.role,
        status: 'ACTIVE', isDefault: true, isOrgAdmin: false, activatedAt: new Date(),
      } });
      // Enrollment is performed through the real authenticated start/verify
      // endpoints after password login, never by seeding credential assurance.
      return email;
    });
  } finally { await prisma.$disconnect(); }
}

/**
 * Logs the seeded role in with a password, then explicitly completes action
 * MFA when the acceptance scenario requests it. Leaves the browser context holding
 * exactly the cookies a real login produces.
 */
export async function loginAs(page: Page, role: CabinetRole, baseURL: string, requireMfa = true): Promise<void> {
  const email = await isolatedAcceptanceEmail(role, baseURL);
  const context = page.context();
  await context.clearCookies();
  await page.goto('/platform-v7/login', { waitUntil: 'load' });
  const token = await csrfToken(context, baseURL);
  const login = await context.request.post('/api/auth/login', {
    headers: { 'content-type': 'application/json', 'x-csrf-token': token },
    data: { email, password: ACCEPTANCE_PASSWORD },
  });
  expect(login.status(), `password login status for ${role}`).toBeLessThan(400);
  const body = await login.json();
  expect(body.ok, `password login for ${role}`).toBe(true);
  expect(body.mfaRequired, `opening ${role} must not require a code`).not.toBe(true);

  // Protected-role acceptance explicitly proves possession after password
  // login. These are ordinary authenticated step-up endpoints, never fixture
  // authority flags or hand-minted cookies.
  if (requireMfa) {
    let verified = false;
    for (let attempt = 0; attempt < 3 && !verified; attempt += 1) {
      if (attempt > 0) await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 1_000);
      const start = await context.request.post('/api/auth/mfa-step-up/start', {
        headers: { 'content-type': 'application/json', 'x-csrf-token': await csrfToken(context, baseURL) }, data: {},
      });
      expect(start.status(), `authenticated MFA start for ${role}`).toBeLessThan(400);
      const setup = await start.json();
      expect(setup.ok, `authenticated enrollment start for ${role}`).toBe(true);
      expect(setup.enrollmentRequired, `fresh ${role} subject must enroll its own secret`).toBe(true);
      expect(setup.setupSecret, `server-generated enrollment secret for ${role}`).toMatch(/^[A-Z2-7]+$/);
      const remaining = 30_000 - (Date.now() % 30_000);
      if (remaining < 5_000) await page.waitForTimeout(remaining + 100);
      const verify = await context.request.post('/api/auth/mfa-step-up/verify', {
        headers: { 'content-type': 'application/json', 'x-csrf-token': await csrfToken(context, baseURL) },
        data: { code: totp(setup.setupSecret) },
      });
      const result = await verify.json().catch(() => ({}));
      verified = verify.ok() && result.mfaVerified === true;
    }
    expect(verified, `actual action MFA for ${role}`).toBe(true);
  }

  const cookies = await context.cookies(baseURL);
  const names = cookies.map((cookie) => cookie.name);
  expect(names, `${role} must hold a server-minted cabinet session`).toContain('pc_v7_cabinet');
  expect(names, `${role} must hold a server-minted access token`).toContain('pc_access_token');
}
