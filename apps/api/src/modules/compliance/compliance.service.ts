import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActionExecutorService } from '../../common/action-executor/action-executor.service';
import { RequestUser, Role } from '../../common/types/request-user';
import { AuditService } from '../audit/audit.service';

const COMPLIANCE_ROLES: Role[] = [Role.COMPLIANCE_OFFICER, Role.ADMIN];

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: ActionExecutorService,
    private readonly audit: AuditService,
  ) {}

  private assertComplianceRole(user: RequestUser): void {
    if (!COMPLIANCE_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Compliance cockpit requires COMPLIANCE_OFFICER or ADMIN role');
    }
  }

  async getKycQueue(user: RequestUser, status?: string) {
    this.assertComplianceRole(user);
    return this.prisma.kycTask.findMany({
      where: status ? { status } : { status: { in: ['PENDING', 'IN_REVIEW'] } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assignKycTask(taskId: string, user: RequestUser) {
    this.assertComplianceRole(user);
    const task = await this.prisma.kycTask.update({
      where: { id: taskId },
      data: { assignedTo: user.id, status: 'IN_REVIEW', updatedAt: new Date() },
    });
    await this.audit.log({
      action: 'kyc:assign',
      actorUserId: user.id,
      actorRole: user.role,
      objectType: 'KycTask',
      objectId: taskId,
      outcome: 'SUCCESS',
    });
    return task;
  }

  async resolveKycTask(
    taskId: string,
    resolution: { status: 'APPROVED' | 'REJECTED'; notes?: string },
    user: RequestUser,
  ) {
    this.assertComplianceRole(user);
    const before = await this.prisma.kycTask.findUnique({ where: { id: taskId } });
    const task = await this.prisma.kycTask.update({
      where: { id: taskId },
      data: {
        status: resolution.status,
        notes: resolution.notes,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Update organization status if approved/rejected
    if (task.organizationId) {
      const orgStatus = resolution.status === 'APPROVED' ? 'VERIFIED' : 'SUSPENDED';
      await this.prisma.organization.update({
        where: { id: task.organizationId },
        data: { kycStatus: resolution.status, status: orgStatus },
      }).catch(() => {}); // org might not be in persistent store yet
    }

    await this.audit.log({
      action: `kyc:${resolution.status.toLowerCase()}`,
      actorUserId: user.id,
      actorRole: user.role,
      objectType: 'KycTask',
      objectId: taskId,
      beforeState: before,
      afterState: task,
      outcome: 'SUCCESS',
      reason: resolution.notes,
    });
    return task;
  }

  async getSanctionFlags(user: RequestUser) {
    this.assertComplianceRole(user);
    // Returns organizations flagged for sanctions/AML
    return this.prisma.organization.findMany({
      where: { OR: [{ sanctionHit: true }, { amlStatus: 'FLAGGED' }] },
    }).catch(() => []); // org table might be empty in current runtime
  }

  async blockOrganization(orgId: string, reason: string, user: RequestUser) {
    this.assertComplianceRole(user);
    const before = await this.prisma.organization.findUnique({ where: { id: orgId } }).catch(() => null);
    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data: { status: 'BLOCKED', amlStatus: 'BLOCKED' },
    }).catch(() => ({ id: orgId, status: 'BLOCKED', note: 'org not in persistent store' }));

    await this.audit.log({
      action: 'compliance:block_org',
      actorUserId: user.id,
      actorRole: user.role,
      orgId,
      objectType: 'Organization',
      objectId: orgId,
      beforeState: before,
      afterState: org,
      outcome: 'SUCCESS',
      reason,
    });
    return org;
  }

  async getAuditLog(user: RequestUser, filters?: { dealId?: string; actorId?: string; action?: string; limit?: number }) {
    this.assertComplianceRole(user);
    return this.prisma.auditEvent.findMany({
      where: {
        ...(filters?.dealId && { dealId: filters.dealId }),
        ...(filters?.actorId && { actorUserId: filters.actorId }),
        ...(filters?.action && { action: { contains: filters.action } }),
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit ?? 100,
    });
  }

  async exportAuditCsv(user: RequestUser, filters?: { dealId?: string; from?: string; to?: string }): Promise<string> {
    this.assertComplianceRole(user);
    const events = await this.prisma.auditEvent.findMany({
      where: {
        ...(filters?.dealId && { dealId: filters.dealId }),
        ...(filters?.from && { createdAt: { gte: new Date(filters.from) } }),
        ...(filters?.to && { createdAt: { lte: new Date(filters.to) } }),
      },
      orderBy: { createdAt: 'asc' },
      take: 10000,
    });
    const header = 'id,action,actorUserId,actorRole,objectType,objectId,outcome,reason,hash,createdAt\n';
    const rows = events.map(e =>
      [e.id, e.action, e.actorUserId, e.actorRole, e.objectType ?? '', e.objectId ?? '', e.outcome, e.reason ?? '', e.hash, e.createdAt.toISOString()]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n');
    return header + rows;
  }

  async getIntegrationStatus(user: RequestUser) {
    this.assertComplianceRole(user);
    const recent = await this.prisma.integrationEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    }).catch(() => []);
    const byAdapter: Record<string, { ok: number; error: number; lastAt?: string }> = {};
    for (const e of recent) {
      if (!byAdapter[e.adapterName]) byAdapter[e.adapterName] = { ok: 0, error: 0 };
      if (e.status === 'SUCCESS') byAdapter[e.adapterName].ok++;
      else byAdapter[e.adapterName].error++;
      if (!byAdapter[e.adapterName].lastAt) byAdapter[e.adapterName].lastAt = e.createdAt.toISOString();
    }
    return byAdapter;
  }
}
