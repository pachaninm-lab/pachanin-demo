import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RequestUser } from '../../common/types/request-user';
import { sha256, stableJson } from '../auth/auth-crypto';
import { StaffAccessRepository } from './staff-access.repository';
import { StaffAccessService } from './staff-access.service';
import { StaffPermission, StaffRole } from './staff-access.types';

const STAFF_MFA_FRESHNESS_MS = 15 * 60 * 1000;

@Injectable()
export class StaffAssignmentService {
  constructor(
    private readonly repository: StaffAccessRepository,
    private readonly access: StaffAccessService,
  ) {}

  async list(user: RequestUser) {
    await this.access.requirePermission(user, StaffPermission.STAFF_ASSIGNMENT_READ);
    return this.repository.prisma.$queryRaw(Prisma.sql`
      SELECT
        a.id,
        a.user_id,
        u.email,
        u."fullName" AS full_name,
        a.role,
        a.status,
        a.valid_from,
        a.valid_until,
        a.granted_by_user_id,
        a.reason,
        a.created_at,
        a.updated_at
      FROM auth.staff_assignments a
      JOIN public.users u ON u.id = a.user_id
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 500
    `);
  }

  async create(user: RequestUser, input: {
    userId: string;
    role: StaffRole;
    validUntil?: string;
    reason: string;
  }, correlationId = randomUUID()) {
    this.assertRecentMfa(user);
    const actorRole = await this.access.requirePermission(user, StaffPermission.STAFF_ASSIGNMENT_WRITE);
    if ([StaffRole.PLATFORM_OWNER, StaffRole.BREAK_GLASS_ADMIN].includes(input.role) && actorRole !== StaffRole.PLATFORM_OWNER) {
      throw new ForbiddenException('Only PLATFORM_OWNER can assign owner or break-glass authority');
    }
    const reason = String(input.reason ?? '').trim();
    if (reason.length < 10) throw new BadRequestException('Assignment reason must be at least 10 characters');
    const validUntil = input.validUntil ? new Date(input.validUntil) : null;
    if (validUntil && (!Number.isFinite(validUntil.getTime()) || validUntil <= new Date())) {
      throw new BadRequestException('validUntil must be in the future');
    }
    const target = await this.repository.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!target || target.deletedAt || target.status !== 'ACTIVE') throw new NotFoundException('Active target user not found');

    const assignmentId = `sta_${randomUUID()}`;
    try {
      await this.repository.transaction(async (tx) => {
        await this.repository.createAssignment(tx, {
          id: assignmentId,
          userId: input.userId,
          role: input.role,
          status: input.role === StaffRole.PLATFORM_OWNER ? 'ACTIVE' : 'ELIGIBLE',
          validUntil,
          grantedByUserId: user.id,
          reason,
        });
        await this.audit(tx, {
          actor: user,
          staffRole: actorRole,
          action: 'staff.assignment.create',
          outcome: 'SUCCESS',
          reason,
          correlationId,
          metadata: { assignmentId, targetUserId: input.userId, assignedRole: input.role, validUntil: validUntil?.toISOString() ?? null },
        });
      });
    } catch (error) {
      if (String((error as { code?: string })?.code ?? '') === 'P2002' || /unique/i.test(String((error as Error)?.message))) {
        throw new ConflictException('An active or eligible assignment for this role already exists');
      }
      throw error;
    }
    return { assignmentId, status: input.role === StaffRole.PLATFORM_OWNER ? 'ACTIVE' : 'ELIGIBLE' };
  }

  async revoke(user: RequestUser, assignmentId: string, reasonInput: string, correlationId = randomUUID()) {
    this.assertRecentMfa(user);
    const actorRole = await this.access.requirePermission(user, StaffPermission.STAFF_ASSIGNMENT_WRITE);
    const reason = String(reasonInput ?? '').trim();
    if (reason.length < 10) throw new BadRequestException('Revocation reason must be at least 10 characters');

    return this.repository.transaction(async (tx) => {
      const assignment = await this.repository.getAssignment(tx, assignmentId, undefined, true);
      if (!assignment) throw new NotFoundException('Staff assignment not found');
      if (assignment.role === StaffRole.PLATFORM_OWNER && actorRole !== StaffRole.PLATFORM_OWNER) {
        throw new ForbiddenException('Only PLATFORM_OWNER can revoke owner authority');
      }
      if (assignment.user_id === user.id && assignment.role === StaffRole.PLATFORM_OWNER) {
        const owners = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM auth.staff_assignments
          WHERE role = 'PLATFORM_OWNER'
            AND status = 'ACTIVE'
            AND (valid_until IS NULL OR valid_until > NOW())
        `);
        if (Number(owners[0]?.count ?? 0n) <= 1) {
          throw new ForbiddenException('The last active platform owner cannot revoke their own assignment');
        }
      }
      const changed = await tx.$executeRaw(Prisma.sql`
        UPDATE auth.staff_assignments
        SET status = 'REVOKED', revoked_at = NOW(), updated_at = NOW()
        WHERE id = ${assignmentId} AND status IN ('ELIGIBLE', 'ACTIVE', 'SUSPENDED')
      `);
      if (changed !== 1) throw new ConflictException('Staff assignment is already inactive');
      await this.audit(tx, {
        actor: user,
        staffRole: actorRole,
        action: 'staff.assignment.revoke',
        outcome: 'SUCCESS',
        reason,
        correlationId,
        metadata: { assignmentId, targetUserId: assignment.user_id, revokedRole: assignment.role },
      });
      return { success: true, assignmentId };
    });
  }

  private assertRecentMfa(user: RequestUser) {
    if (!user.mfaVerified || !user.mfaVerifiedAt) throw new ForbiddenException('Staff administration requires MFA');
    const age = Date.now() - new Date(user.mfaVerifiedAt).getTime();
    if (!Number.isFinite(age) || age < 0 || age > STAFF_MFA_FRESHNESS_MS) {
      throw new ForbiddenException('Staff administration requires recent MFA verification');
    }
  }

  private async audit(tx: Prisma.TransactionClient, input: {
    actor: RequestUser;
    staffRole: StaffRole;
    action: string;
    outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
    reason: string;
    correlationId: string;
    metadata: Record<string, unknown>;
  }) {
    const prevHash = await this.repository.latestEventHash(tx, input.actor.id);
    const eventId = `sae_${randomUUID()}`;
    const payload = {
      id: eventId,
      actorUserId: input.actor.id,
      staffRole: input.staffRole,
      action: input.action,
      outcome: input.outcome,
      reason: input.reason,
      correlationId: input.correlationId,
      metadata: input.metadata,
      prevHash,
    };
    await this.repository.insertEvent(tx, {
      id: eventId,
      actorUserId: input.actor.id,
      staffRole: input.staffRole,
      action: input.action,
      outcome: input.outcome,
      reason: input.reason,
      correlationId: input.correlationId,
      metadata: input.metadata,
      prevHash,
      hash: sha256(stableJson(payload)),
    });
  }
}
