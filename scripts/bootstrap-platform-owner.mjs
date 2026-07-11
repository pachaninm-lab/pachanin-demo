#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';

const email = String(process.env.BOOTSTRAP_PLATFORM_OWNER_EMAIL ?? '').trim().toLowerCase();
const reason = String(process.env.BOOTSTRAP_PLATFORM_OWNER_REASON ?? '').trim();
const confirmation = String(process.env.BOOTSTRAP_PLATFORM_OWNER_CONFIRM ?? '').trim();

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!email) throw new Error('BOOTSTRAP_PLATFORM_OWNER_EMAIL is required');
if (reason.length < 20) throw new Error('BOOTSTRAP_PLATFORM_OWNER_REASON must be at least 20 characters');
if (confirmation !== `CREATE_PLATFORM_OWNER:${email}`) {
  throw new Error('BOOTSTRAP_PLATFORM_OWNER_CONFIRM must exactly match CREATE_PLATFORM_OWNER:<email>');
}

const prisma = new PrismaClient();
const stable = (value) => JSON.stringify(value, Object.keys(value).sort());
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

try {
  const result = await prisma.$transaction(async (tx) => {
    const existingOwners = await tx.$queryRaw(Prisma.sql`
      SELECT a.id, a.user_id, u.email
      FROM auth.staff_assignments a
      JOIN public.users u ON u.id = a.user_id
      WHERE a.role = 'PLATFORM_OWNER'
        AND a.status = 'ACTIVE'
        AND (a.valid_until IS NULL OR a.valid_until > NOW())
      FOR UPDATE OF a
    `);
    if (existingOwners.length > 0) {
      throw new Error('An active PLATFORM_OWNER already exists; use the staff assignment approval workflow');
    }

    const users = await tx.$queryRaw(Prisma.sql`
      SELECT id, email, status, "deletedAt" AS deleted_at
      FROM public.users
      WHERE LOWER(email) = LOWER(${email})
      LIMIT 1
      FOR UPDATE
    `);
    const user = users[0];
    if (!user || user.status !== 'ACTIVE' || user.deleted_at) {
      throw new Error('Target user must already exist and be ACTIVE');
    }

    const assignmentId = `sta_${randomUUID()}`;
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO auth.staff_assignments (
        id, user_id, role, status, activated_at, granted_by_user_id, reason
      ) VALUES (
        ${assignmentId}, ${user.id}, 'PLATFORM_OWNER', 'ACTIVE', NOW(), ${user.id}, ${reason}
      )
    `);

    const previous = await tx.$queryRaw(Prisma.sql`
      SELECT hash
      FROM auth.staff_access_events
      WHERE actor_user_id = ${user.id}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `);
    const eventId = `sae_${randomUUID()}`;
    const correlationId = `bootstrap_${randomUUID()}`;
    const payload = {
      id: eventId,
      actorUserId: user.id,
      staffRole: 'PLATFORM_OWNER',
      action: 'staff.assignment.bootstrap-owner',
      outcome: 'SUCCESS',
      reason,
      correlationId,
      assignmentId,
      previousHash: previous[0]?.hash ?? null,
    };
    const hash = sha256(stable(payload));
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO auth.staff_access_events (
        id, actor_user_id, staff_role, action, outcome, reason,
        correlation_id, metadata, prev_hash, hash
      ) VALUES (
        ${eventId}, ${user.id}, 'PLATFORM_OWNER', 'staff.assignment.bootstrap-owner',
        'SUCCESS', ${reason}, ${correlationId},
        ${JSON.stringify({ assignmentId, bootstrap: true })}::jsonb,
        ${previous[0]?.hash ?? null}, ${hash}
      )
    `);

    return { assignmentId, userId: user.id, email: user.email, correlationId };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5_000,
    timeout: 15_000,
  });

  console.log(JSON.stringify({
    success: true,
    ...result,
    note: 'MFA enrollment is required by the staff-assignment trigger before staff access can be used.',
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
