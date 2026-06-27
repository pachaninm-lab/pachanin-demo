import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';

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

@Injectable()
export class FactoringService {
  private readonly apps: FactoringApplication[] = [];
  private counter = 0;

  constructor(@Optional() private readonly prisma?: PrismaService) {}

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

    if (this.prisma) {
      const deals = await this.prisma.deal.findMany({
        where: { sellerOrgId: organizationId },
        select: { status: true, totalKopecks: true, totalRub: true },
      }).catch(() => []);

      totalDeals = deals.length;
      closedDeals = deals.filter(d => d.status === 'CLOSED' || d.status === 'SETTLED').length;
      totalVolumeKopecks = deals.reduce((s, d) => s + (d.totalKopecks ?? Math.round((d.totalRub ?? 0) * 100)), 0);

      disputeCount = await this.prisma.dispute.count({ where: { createdAt: { gte: new Date(Date.now() - 365 * 24 * 3600_000) } } }).catch(() => 0);
    } else {
      totalDeals = 12;
      closedDeals = 10;
      totalVolumeKopecks = 5_000_000_00;
      disputeCount = 1;
    }

    const successRate = totalDeals > 0 ? closedDeals / totalDeals : 0;
    const disputeRate = totalDeals > 0 ? disputeCount / totalDeals : 0;
    const volumeScore = Math.min(totalVolumeKopecks / 100_000_000, 1); // up to 1M RUB = max

    const score = Math.round(
      successRate * 40 +
      (1 - Math.min(disputeRate, 1)) * 30 +
      volumeScore * 20 +
      (totalDeals >= 5 ? 10 : totalDeals * 2),
    );

    return {
      score: Math.min(score, 100),
      details: {
        totalDeals,
        closedDeals,
        successRatePct: Math.round(successRate * 100),
        disputeCount,
        disputeRatePct: Math.round(disputeRate * 100),
        totalVolumeRub: Math.round(totalVolumeKopecks / 100),
      },
    };
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
    if (app.status !== 'ACTIVE') throw new ForbiddenException('Только ACTIVE задолженности можно погасить');
    app.status = 'REPAID';
    return app;
  }

  listFactors(): string[] {
    return ALLOWED_FACTORS;
  }
}
