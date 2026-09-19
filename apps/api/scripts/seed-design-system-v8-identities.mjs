#!/usr/bin/env node
/**
 * Seeds the Design System v8 acceptance database with one activated identity
 * per cabinet role.
 *
 * The acceptance matrix has to render all twelve role shells, and the platform
 * layout only accepts a cabinet session whose user, membership, organization
 * and tenant match a live /auth/me profile. There is no way to satisfy that
 * with a hand-minted cookie, and no reason to: this script creates the
 * database rows a real account has, and the acceptance run then logs in
 * through the ordinary login route so the session and the cabinet cookie are
 * both minted by production code.
 *
 * Only the rows are fixtures. Password hashing is bcrypt exactly as the API
 * writes it, every membership is ACTIVE in a VERIFIED organization, and no
 * role is granted that a human cannot hold — BANK_CALLBACK is a machine
 * principal and is deliberately absent.
 *
 * Refuses to run against a database that is not clearly ephemeral.
 */

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { encryptMfaSecret } from '../dist/apps/api/src/modules/auth/auth-crypto.js';

export const ACCEPTANCE_PASSWORD = 'Acceptance!Passw0rd-v8';

/**
 * Privileged roles require a second factor, and the API only discloses a fresh
 * TOTP secret during enrolment — a second login returns none. Five browser
 * projects each log in, so enrolment is pre-completed here with a known secret
 * and the acceptance run then performs an ordinary steady-state login with a
 * real TOTP code, exactly like a returning user.
 */
export const ACCEPTANCE_TOTP_SECRET = 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU';

/**
 * Cabinet role → the API role a human actually holds. The mapping mirrors
 * API_ROLE_TO_CABINET in apps/web/lib/platform-v7/verified-session.ts.
 */
export const ACCEPTANCE_IDENTITIES = Object.freeze([
  { cabinet: 'operator', apiRole: 'ADMIN' },
  { cabinet: 'buyer', apiRole: 'BUYER' },
  { cabinet: 'seller', apiRole: 'FARMER' },
  { cabinet: 'logistics', apiRole: 'LOGISTICIAN' },
  { cabinet: 'driver', apiRole: 'DRIVER' },
  { cabinet: 'surveyor', apiRole: 'SURVEYOR' },
  { cabinet: 'elevator', apiRole: 'ELEVATOR' },
  { cabinet: 'lab', apiRole: 'LAB' },
  { cabinet: 'bank', apiRole: 'ACCOUNTING' },
  { cabinet: 'arbitrator', apiRole: 'ARBITRATOR' },
  { cabinet: 'compliance', apiRole: 'COMPLIANCE_OFFICER' },
  { cabinet: 'executive', apiRole: 'EXECUTIVE' },
]);

export function acceptanceEmail(cabinetRole) {
  return `dsv8.${cabinetRole}@acceptance.invalid`;
}

/** A checksum-valid 10-digit INN, so the fixture cannot be mistaken for a real filing. */
function acceptanceInn(index) {
  const base = `77${String(700000 + index).padStart(7, '0')}`.slice(0, 9);
  const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8];
  const sum = weights.reduce((total, weight, position) => total + weight * Number(base[position]), 0);
  return `${base}${(sum % 11) % 10}`;
}

function assertEphemeralTarget(url) {
  const target = String(url || '');
  if (!target) throw new Error('DATABASE_URL is required');
  const host = /@([^/:]+)/.exec(target)?.[1] ?? '';
  const local = host === 'localhost' || host === '127.0.0.1' || host === 'postgres';
  if (!local) {
    throw new Error(`Refusing to seed acceptance identities into a non-local database host: ${host}`);
  }
  if (!/acceptance|_e2e|design_system|dsv8/i.test(target)) {
    throw new Error('Refusing to seed: database name must identify an ephemeral acceptance database');
  }
}

export async function seedAcceptanceIdentities(prisma, password = ACCEPTANCE_PASSWORD) {
  const passwordHash = await bcrypt.hash(password, 10);
  const seeded = [];

  for (const [index, identity] of ACCEPTANCE_IDENTITIES.entries()) {
    const email = acceptanceEmail(identity.cabinet);
    const organization = await prisma.organization.upsert({
      where: { inn: acceptanceInn(index) },
      update: { status: 'VERIFIED', verifiedAt: new Date() },
      create: {
        inn: acceptanceInn(index),
        name: `Acceptance ${identity.cabinet} organization`,
        type: 'LEGAL',
        status: 'VERIFIED',
        kycStatus: 'APPROVED',
        verifiedAt: new Date(),
      },
    });

    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, status: 'ACTIVE', deletedAt: null },
      create: {
        email,
        passwordHash,
        fullName: `Acceptance ${identity.cabinet}`,
        status: 'ACTIVE',
      },
    });

    const membership = await prisma.userOrg.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
      update: {
        role: identity.apiRole,
        status: 'ACTIVE',
        isDefault: true,
        activatedAt: new Date(),
        revokedAt: null,
      },
      create: {
        userId: user.id,
        organizationId: organization.id,
        role: identity.apiRole,
        status: 'ACTIVE',
        isDefault: true,
        isOrgAdmin: false,
        activatedAt: new Date(),
      },
    });

    // Complete TOTP enrolment up front so every project's login is a normal
    // password + second factor login against a secret the run already knows.
    const { ciphertext, keyVersion } = encryptMfaSecret(ACCEPTANCE_TOTP_SECRET);
    await prisma.$executeRawUnsafe(
      `INSERT INTO auth.credential_states (user_id, mfa_enabled, mfa_secret_ciphertext, mfa_key_version)
       VALUES ($1, TRUE, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
         SET mfa_enabled = TRUE,
             mfa_secret_ciphertext = EXCLUDED.mfa_secret_ciphertext,
             mfa_key_version = EXCLUDED.mfa_key_version,
             updated_at = NOW()`,
      user.id,
      ciphertext,
      keyVersion,
    );

    seeded.push({
      cabinet: identity.cabinet,
      apiRole: identity.apiRole,
      email,
      userId: user.id,
      membershipId: membership.id,
      organizationId: organization.id,
      tenantId: organization.tenantId,
    });
  }

  return seeded;
}

async function main() {
  assertEphemeralTarget(process.env.DATABASE_URL);
  const prisma = new PrismaClient();
  try {
    const seeded = await seedAcceptanceIdentities(prisma);
    // Identifiers only. The shared password is a constant in this file and is
    // never written to the log, so the output stays safe to attach as evidence.
    console.log(JSON.stringify({
      schemaVersion: 'design-system-v8.acceptance-identities.v1',
      count: seeded.length,
      identities: seeded.map(({ cabinet, apiRole, email }) => ({ cabinet, apiRole, email })),
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
