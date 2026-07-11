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
import { StaffPermission, StaffRole, isStaffRole } from './staff-access.types';

export type BreakGlassRow = {
  id: string;
  actor_user_id: string;
  assignment_id: string;
  role: string;
  reason: string;
  ticket_id: string;
  status: string;
  started_at: Date;
  expires_at: Date;
  ended_at: Date | null;
  end_reason: string | null;
  notification_correlation_id: string;
};

@Injectable()
export class StaffEmergencyService {
  constructor(
    private readonly repository: StaffAccessRepository,
    private readonly access: StaffAccessService,
  ) {}

  async listActive(user: RequestUser) {
    const role = await this.access.requirePermission(user, StaffPermission.STAFF_SESSION_READ);
    const global = role === StaffRole.PLATFORM_OWNER || role === StaffRole.SECURITY_AUDITOR;
    const actorFilter = global ? Prisma.empty : Prisma.sql` AND b.actor_user_id = ${user.id}`;
    return this.repository.prisma.$queryRaw<BreakGlassRow[]>(Prisma.sql`
      SELECT
        b.id,
        b.actor_user_id,
        b.assignment_id,
        a.role,
        b.reason,
        b.ticket_id,
        b.status,
        b.started_at,
        b.expires_at,
        b.ended_at,
        b.end_reason,
        b.notification_correlation_id
      FROM auth.break_glass_activations b
      JOIN auth.staff_assignments a ON a.id = b.assignment_id
      WHERE b.status = 'ACTIVE'
        AND b.expires_at > NOW()${actorFilter}
      ORDER BY b.started_at DESC, b.id DESC
      LIMIT 100
    `);
  }

  async end(
    user: RequestUser,
    activationId: string,
    reasonInput: string,
    correlationId: string = randomUUID(),
  ) {
    const actorRoles = await this.repository.listActiveAssignments(this.repository.prisma, user.id);
    const roles: StaffRole[] = actorRoles.map((row) => row.role).filter(isStaffRole);
    if (roles.length === 0) throw new ForbiddenException('Active staff assignment is required');
    const reason = String(reasonInput ?? '').trim();
    if (reason.length < 10) throw new BadRequestException('End reason must be at least 10 characters');

    return this.repository.transaction(async (tx) => {
      const rows = await tx.$queryRaw<BreakGlassRow[]>(Prisma.sql`
        SELECT b.*, a.role
        FROM auth.break_glass_activations b
        JOIN auth.staff_assignments a ON a.id = b.assignment_id
        WHERE b.id = ${activationId}
        FOR UPDATE OF b
      `);
      const activation = rows[0];
      if (!activation || !isStaffRole(activation.role)) throw new NotFoundException('Break-glass activation not found');
      const canEndAny = roles.includes(StaffRole.PLATFORM_OWNER) || roles.includes(StaffRole.SECURITY_AUDITOR);
      if (activation.actor_user_id !== user.id && !canEndAny) {
        throw new ForbiddenException('Only the actor, PLATFORM_OWNER or SECURITY_AUDITOR can end this activation');
      }
      if (activation.status !== 'ACTIVE') throw new ConflictException('Break-glass activation is not active');
      const changed = await this.repository.endBreakGlass(tx, activation.id, activation.actor_user_id, reason);
      if (!changed) throw new ConflictException('Break-glass activation changed concurrently');

      const staffRole = roles.includes(StaffRole.PLATFORM_OWNER)
        ? StaffRole.PLATFORM_OWNER
        : roles.includes(StaffRole.SECURITY_AUDITOR)
          ? StaffRole.SECURITY_AUDITOR
          : activation.role;
      const prevHash = await this.repository.latestEventHash(tx, user.id);
      const eventId = `sae_${randomUUID()}`;
      const metadata = {
        activationId,
        activationActorUserId: activation.actor_user_id,
        notificationRequired: true,
        postIncidentReviewRequired: true,
      };
      const payload = {
        id: eventId,
        actorUserId: user.id,
        staffRole,
        accessSessionId: null,
        grantId: null,
        action: 'staff.break-glass.end',
        resourceType: 'break_glass_activation',
        resourceId: activationId,
        outcome: 'SUCCESS',
        reason,
        ticketId: activation.ticket_id,
        correlationId,
        metadata,
        prevHash,
      };
      await this.repository.insertEvent(tx, {
        id: eventId,
        actorUserId: user.id,
        staffRole,
        action: 'staff.break-glass.end',
        resourceType: 'break_glass_activation',
        resourceId: activationId,
        outcome: 'SUCCESS',
        reason,
        ticketId: activation.ticket_id,
        correlationId,
        metadata,
        prevHash,
        hash: sha256(stableJson(payload)),
      });
      return {
        success: true,
        activationId,
        notificationRequired: true,
        postIncidentReviewRequired: true,
      };
    });
  }
}
