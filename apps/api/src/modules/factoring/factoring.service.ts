import { ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';
import { integrationRegistry } from '../../../../../packages/integration-sdk/src/registry';
import type { MockBkiAdapter } from '../../../../../packages/integration-sdk/src/adapters/bki.adapter';
import { NotificationsService } from '../notifications/notifications.service';

export type FactoringStatus = 'PENDING' | 'SCORING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'REPAID' | 'OVERDUE';

export interface FactoringApplication {
  id: string;
  dealId: string;
  organizationId: string;
  factorName: string;
  requestedAmountKopecks: number;
  approvedAmountKopecks?: number;
  ratePercent?: number;
  termDays?: number;
  status: FactoringStatus;
  platformScore: number;
  scoringDetails: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  decidedAt?: string;
  rejectionReason?: string;
  dueDate?: string;
}

const FINANCE_ROLES: Role[] = [Role.ADMIN, Role.ACCOUNTING, Role.EXECUTIVE, Role.FARMER, Role.BUYER];
const ALLOWED_FACTORS = ['Сбербанк Факторинг', 'ВТБ Факторинг', 'Альфа-Банк', 'Открытие Факторинг', 'ПСБ Факторинг'];
const DUE_SOON_DAYS = [7, 3];
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

@Injectable()
export class FactoringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FactoringService.name);
  private readonly apps: FactoringApplication[] = [];
  private counter = 0;
  private timer: NodeJS.Timeout | null = null;
  private readonly overdueOrgs = new Set<string>();

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.checkOverdue(), CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  checkOverdue(): { checked: number; overdue: number; dueSoon: number } {
    const now = new Date();
    let overdue = 0;
    let dueSoon = 0;

    for (const app of this.apps) {
      if (app.status !== 'ACTIVE' || !app.dueDate) continue;
      const due = new Date(app.dueDate);
      const daysLeft = Math.round((due.getTime() - now.getTime()) / 86400_000);

      if (daysLeft < 0 && app.status === 'ACTIVE') {
        app.status = 'OVERDUE';
        overdue++;
        this.overdueOrgs.add(app.organizationId);
        this.logger.warn(`Factoring OVERDUE: appId=${app.id} org=${app.organizationId}`);
        this.notifications?.send(
          app.createdBy,
          `Задолженность по факторинговому договору ${app.id} просрочена. Новые сделки заблокированы до погашения.`,
          'factoring:overdue',
          { dealId: app.dealId },
        );
      } else if (DUE_SOON_DAYS.includes(daysLeft)) {
        dueSoon++;
        this.notifications?.send(
          app.createdBy,
          `Погашение по договору ${app.id} через ${daysLeft} ${daysLeft === 1 ? 'день' : 'дня'}. Сумма: ${Math.round((app.approvedAmountKopecks ?? 0) / 100).toLocaleString('ru-RU')} ₽.`,
          'factoring:due_soon',
          { dealId: app.dealId },
        );
      }
    }

    return { checked: this.apps.length, overdue, dueSoon };
  }

  isOrganizationBlocked(organizationId: string): boolean {
    return this.overdueOrgs.has(organizationId);
  }

  unblockAfterRepayment(organizationId: string): void {
    this.overdueOrgs.delete(organizationId);
  }

  async createApplication(params: {
    dealId: string;
    organizationId: string;
    factorName: string;
    requestedAmountKopecks: number;
  }, user: RequestUser): Promise<FactoringApplication> {
    if (!FINANCE_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Доступ запрещён');
    }
    if (!ALLOWED_FACTORS.includes(params.factorName)) {
      throw new ForbiddenException(`Факторинговая компания "${params.factorName}" не подключена`);
    }

    const score = await this.scoreOrganization(params.organizationId);

    const app: FactoringApplication = {
      id: `FACTOR-${String(++this.counter).padStart(5, '0')}`,
      dealId: params.dealId,
      organizationId: params.organizationId,
      factorName: params.factorName,
      requestedAmountKopecks: params.requestedAmountKopecks,
      status: 'SCORING',
      platformScore: score.score,
      scoringDetails: score.details,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };

    // Auto-approve/reject based on platform score
    if (score.score >= 70) {
      const approvedPct = score.score >= 85 ? 1.0 : 0.75;
      app.approvedAmountKopecks = Math.round(params.requestedAmountKopecks * approvedPct);
      app.ratePercent = score.score >= 85 ? 8.5 : 12.0;
      app.termDays = 90;
      app.status = 'APPROVED';
      app.decidedAt = new Date().toISOString();
      app.dueDate = new Date(Date.now() + 90 * 24 * 3600_000).toISOString();
    } else if (score.score < 35) {
      app.status = 'REJECTED';
      app.decidedAt = new Date().toISOString();
      app.rejectionReason = 'Недостаточный рейтинг на платформе для получения факторинга';
    } else {
      app.status = 'PENDING';
    }

    this.apps.push(app);
    return app;
  }

  async scoreOrganization(organizationId: string): Promise<{ score: number; details: Record<string, unknown> }> {
    let closedDeals = 0;
    let totalDeals = 0;
    let disputeCount = 0;
    let totalVolumeKopecks = 0;
    let orgInn: string | undefined;
    let orgName: string | undefined;

    if (this.prisma) {
      const deals = await this.prisma.deal.findMany({
        where: { sellerOrgId: organizationId },
        select: { status: true, totalKopecks: true, totalRub: true },
      }).catch(() => []);

      totalDeals = deals.length;
      closedDeals = deals.filter(d => d.status === 'CLOSED' || d.status === 'SETTLED').length;
      totalVolumeKopecks = deals.reduce((s, d) => s + (d.totalKopecks ?? Math.round((d.totalRub ?? 0) * 100)), 0);

      disputeCount = await this.prisma.dispute.count({ where: { createdAt: { gte: new Date(Date.now() - 365 * 24 * 3600_000) } } }).catch(() => 0);

      const org = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { inn: true, name: true } }).catch(() => null);
      orgInn = org?.inn;
      orgName = org?.name;
    } else {
      totalDeals = 12;
      closedDeals = 10;
      totalVolumeKopecks = 5_000_000_00;
      disputeCount = 1;
      orgInn = '7712345678';
    }

    const successRate = totalDeals > 0 ? closedDeals / totalDeals : 0;
    const disputeRate = totalDeals > 0 ? disputeCount / totalDeals : 0;
    const volumeScore = Math.min(totalVolumeKopecks / 100_000_000, 1);

    const platformScore = Math.round(
      successRate * 40 +
      (1 - Math.min(disputeRate, 1)) * 30 +
      volumeScore * 20 +
      (totalDeals >= 5 ? 10 : totalDeals * 2),
    );

    // BKI credit bureau scoring — enriches platform score
    let bkiReport: Record<string, unknown> = {};
    let bkiWeight = 0;
    if (orgInn && integrationRegistry.has('BKI_NBKI')) {
      try {
        const bki = integrationRegistry.get<MockBkiAdapter>('BKI_NBKI');
        const report = await bki.getCreditReport(orgInn, orgName);
        bkiReport = {
          creditScore: report.creditScore,
          rating: report.rating,
          openLoans: report.openLoans,
          utilizationPct: report.utilizationPct,
          flags: report.flags,
          bureau: report.bureau,
        };
        // Map BKI score (300-850) to 0-100 points (weight: 30 points out of combined)
        bkiWeight = Math.round(((report.creditScore - 300) / 550) * 30);
        if (report.flags.includes('overdue_90d')) bkiWeight = Math.max(0, bkiWeight - 20);
      } catch {
        // BKI unavailable — fall back to platform score only
      }
    }

    const combined = bkiWeight > 0
      ? Math.round(platformScore * 0.7 + bkiWeight)
      : platformScore;

    return {
      score: Math.min(combined, 100),
      details: {
        totalDeals,
        closedDeals,
        successRatePct: Math.round(successRate * 100),
        disputeCount,
        disputeRatePct: Math.round(disputeRate * 100),
        totalVolumeRub: Math.round(totalVolumeKopecks / 100),
        platformScore,
        bki: bkiReport,
      },
    };
  }

  async getCreditReport(organizationId: string, user: RequestUser): Promise<Record<string, unknown>> {
    if (![Role.ADMIN, Role.ACCOUNTING, Role.EXECUTIVE, Role.FARMER, Role.BUYER].includes(user.role as Role)) {
      throw new ForbiddenException();
    }
    let inn = '7712345678';
    let name: string | undefined;
    if (this.prisma) {
      const org = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { inn: true, name: true } }).catch(() => null);
      if (org) { inn = org.inn; name = org.name; }
    }
    const bki = integrationRegistry.get<MockBkiAdapter>('BKI_NBKI');
    const report = await bki.getCreditReport(inn, name);
    return { organizationId, ...report };
  }

  list(user: RequestUser): FactoringApplication[] {
    if (!FINANCE_ROLES.includes(user.role as Role)) throw new ForbiddenException();
    if (user.role === Role.ADMIN || user.role === Role.ACCOUNTING || user.role === Role.EXECUTIVE) {
      return [...this.apps].reverse();
    }
    return this.apps.filter(a => a.createdBy === user.id).reverse();
  }

  getOne(id: string, user: RequestUser): FactoringApplication {
    const app = this.apps.find(a => a.id === id);
    if (!app) throw new NotFoundException(`Factoring application ${id} not found`);
    if (app.createdBy !== user.id && ![Role.ADMIN, Role.ACCOUNTING, Role.EXECUTIVE].includes(user.role as Role)) {
      throw new ForbiddenException();
    }
    return app;
  }

  markActive(id: string, user: RequestUser): FactoringApplication {
    const app = this.getOne(id, user);
    if (app.status !== 'APPROVED') throw new ForbiddenException('Только APPROVED заявки можно активировать');
    app.status = 'ACTIVE';
    return app;
  }

  markRepaid(id: string, user: RequestUser): FactoringApplication {
    const app = this.getOne(id, user);
    if (!['ACTIVE', 'OVERDUE'].includes(app.status)) throw new ForbiddenException('Только ACTIVE/OVERDUE задолженности можно погасить');
    app.status = 'REPAID';
    // Снять блокировку если больше нет просроченных заявок этой организации
    const stillOverdue = this.apps.some(a => a.organizationId === app.organizationId && a.status === 'OVERDUE' && a.id !== id);
    if (!stillOverdue) this.unblockAfterRepayment(app.organizationId);
    return app;
  }

  listFactors(): string[] {
    return ALLOWED_FACTORS;
  }
}
