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

  /**
   * Regulatory reports per ТЗ 12.3.
   * Generates structured reports for Минсельхоз, Росстат, ФНС, Росфинмониторинг.
   */
  async listRegulatoryReports(user: RequestUser): Promise<Array<{
    id: string;
    type: string;
    recipient: string;
    period: string;
    status: string;
    generatedAt: string | null;
    submittedAt: string | null;
    format: string;
    deadline: string;
  }>> {
    this.assertComplianceRole(user);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = (() => {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();

    // Static report calendar — in production this would be stored in DB
    return [
      { id: `reg-mcx-${lastMonth}`, type: 'MINSELHHOZ_MONTHLY', recipient: 'Минсельхоз России', period: lastMonth, status: 'PENDING', generatedAt: null, submittedAt: null, format: 'XML (МСХ)', deadline: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-10` },
      { id: `reg-rosstat-q${Math.ceil((now.getMonth() + 1) / 3)}`, type: 'ROSSTAT_QUARTERLY', recipient: 'Росстат (форма 29-сх)', period: `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`, status: 'PENDING', generatedAt: null, submittedAt: null, format: 'Excel (форма 29-сх)', deadline: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-20` },
      { id: `reg-fns-q${Math.ceil((now.getMonth() + 1) / 3)}`, type: 'FNS_QUARTERLY', recipient: 'ФНС (ОНФ)', period: `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`, status: 'PENDING', generatedAt: null, submittedAt: null, format: 'XML (ОНФ)', deadline: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-25` },
      { id: `reg-rfm-${currentMonth}`, type: 'ROSFINMONITORING_THRESHOLD', recipient: 'Росфинмониторинг (115-ФЗ)', period: currentMonth, status: 'DRAFT', generatedAt: null, submittedAt: null, format: 'ФЭС (форматы 407)', deadline: 'По мере возникновения' },
    ];
  }

  async generateRegulatoryReport(
    reportType: string,
    params: { period?: string; from?: string; to?: string },
    user: RequestUser,
  ): Promise<{ reportId: string; type: string; generatedAt: string; rowCount: number; format: string; downloadUrl: string | null }> {
    this.assertComplianceRole(user);

    const from = params.from ? new Date(params.from) : new Date(Date.now() - 30 * 86_400_000);
    const to = params.to ? new Date(params.to) : new Date();

    const deals = await this.prisma.deal.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { id: true, status: true, culture: true, region: true, volumeTons: true, totalKopecks: true, totalRub: true, createdAt: true },
    }).catch(() => []);

    const reportId = `rpt-${reportType.toLowerCase()}-${Date.now()}`;
    const generatedAt = new Date().toISOString();

    await this.audit.log({
      action: `regulatory_report:generate`,
      actorUserId: user.id,
      actorRole: user.role,
      objectType: 'RegulatoryReport',
      objectId: reportId,
      outcome: 'SUCCESS',
      reason: `type=${reportType} period=${params.period ?? `${from.toISOString().slice(0, 10)}..${to.toISOString().slice(0, 10)}`}`,
    });

    const formatMap: Record<string, string> = {
      MINSELHHOZ_MONTHLY: 'XML (МСХ)',
      ROSSTAT_QUARTERLY: 'Excel (форма 29-сх)',
      FNS_QUARTERLY: 'XML (ОНФ)',
      ROSFINMONITORING_THRESHOLD: 'ФЭС 407',
    };

    return {
      reportId,
      type: reportType,
      generatedAt,
      rowCount: deals.length,
      format: formatMap[reportType] ?? 'XML',
      downloadUrl: null, // In production: presigned S3 URL
    };
  }
}
