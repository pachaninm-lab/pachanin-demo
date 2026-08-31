import { createHmac } from 'node:crypto';
import { expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * Real login for the Design System v8 acceptance matrix.
 *
 * The platform layout only trusts a cabinet session whose user, membership,
 * organization and tenant match a live /auth/me profile, so a hand-minted
 * cookie cannot open a cabinet and should not be able to. This helper drives
 * the ordinary login route instead: the server verifies the password against
 * PostgreSQL, enforces the second factor, and mints both the session and the
 * cabinet cookie through the same code production runs.
 *
 * Nothing here weakens the boundary. The only test-supplied inputs are a
 * seeded account's own credentials.
 */

export const ACCEPTANCE_PASSWORD = 'Acceptance!Passw0rd-v8';

/**
 * The TOTP secret the seed enrols for every acceptance account. The API only
 * discloses a generated secret during enrolment, so pre-enrolling with a known
 * one is what lets each browser project perform an ordinary returning-user
 * login instead of a first-time setup.
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

/**
 * Logs the given seeded role in through the real login route, completing the
 * second factor when the server demands it. Leaves the browser context holding
 * exactly the cookies a real login produces.
 */
export async function loginAs(page: Page, role: CabinetRole, baseURL: string): Promise<void> {
  const context = page.context();
  await context.clearCookies();

  // The login page is what issues the CSRF cookie in production.
  await page.goto('/platform-v7/login', { waitUntil: 'load' });
  const token = await csrfToken(context, baseURL);

  const login = await context.request.post('/api/auth/login', {
    headers: { 'content-type': 'application/json', 'x-csrf-token': token },
    data: { email: acceptanceEmail(role), password: ACCEPTANCE_PASSWORD },
  });
  expect(login.status(), `login status for ${role}`).toBeLessThan(400);
  const body = await login.json();

  if (body.mfaRequired) {
    // A generated secret is only returned when the account still has to enrol;
    // the seeded accounts are already enrolled on the shared secret.
    const secret = String(body.setupSecret || ACCEPTANCE_TOTP_SECRET);

    // Entering the MFA-pending state intentionally rotates the browser session
    // and its CSRF token. Read the server-minted replacement instead of
    // replaying the pre-login token captured above.
    const mfaToken = await csrfToken(context, baseURL);

    // A TOTP code cannot be presented twice, so a login landing in the same
    // 30-second window as a previous one for the same account has to wait for
    // the next step rather than fail the matrix.
    let verified = false;
    let lastStatus = 0;
    for (let attempt = 0; attempt < 3 && !verified; attempt += 1) {
      if (attempt > 0) await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 1_000);
      const verify = await context.request.post('/api/auth/mfa-login', {
        headers: { 'content-type': 'application/json', 'x-csrf-token': mfaToken },
        data: { code: totp(secret) },
      });
      lastStatus = verify.status();
      verified = lastStatus < 400 && (await verify.json()).ok === true;
    }
    expect(verified, `MFA verification for ${role} (last status ${lastStatus})`).toBe(true);
  } else {
    expect(body.ok, `login for ${role}`).toBe(true);
  }

  const cookies = await context.cookies(baseURL);
  const names = cookies.map((cookie) => cookie.name);
  expect(names, `${role} must hold a server-minted cabinet session`).toContain('pc_v7_cabinet');
  expect(names, `${role} must hold a server-minted access token`).toContain('pc_access_token');
}
