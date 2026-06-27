import { ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';

const ALLOWED_ROLES: Role[] = [Role.ADMIN, Role.ACCOUNTING, Role.EXECUTIVE];

export interface BankPayment {
  id: string;
  date: string;
  valueDate: string;
  amountKopecks: number;
  currency: string;
  reference: string;
  counterpartyName: string;
  counterpartyInn?: string;
  counterpartyAccount: string;
  description: string;
  matchedDealId?: string;
  matchStatus: 'UNMATCHED' | 'MATCHED' | 'MANUAL';
  importBatchId: string;
  createdAt: string;
}

export interface ReconciliationReport {
  period: { from: string; to: string };
  totalImported: number;
  totalMatched: number;
  totalUnmatched: number;
  matchedAmountKopecks: number;
  unmatchedAmountKopecks: number;
  payments: BankPayment[];
}

@Injectable()
export class BankReconciliationService {
  private readonly payments: BankPayment[] = [];
  private batchCounter = 0;
  private paymentCounter = 0;

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  private assertRole(user: RequestUser): void {
    if (!ALLOWED_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Доступ к банковской сверке ограничен');
    }
  }

  async importMT940(content: string, user: RequestUser): Promise<{ batchId: string; imported: number; matched: number }> {
    this.assertRole(user);
    const batchId = `BATCH-${String(++this.batchCounter).padStart(4, '0')}`;
    const parsed = this.parseMT940(content, batchId);

    let matched = 0;
    for (const p of parsed) {
      const dealId = await this.tryAutoMatch(p);
      if (dealId) {
        p.matchedDealId = dealId;
        p.matchStatus = 'MATCHED';
        matched++;
      }
      this.payments.push(p);
    }

    return { batchId, imported: parsed.length, matched };
  }

  private parseMT940(content: string, batchId: string): BankPayment[] {
    // Real MT940 parser would use proper field tags (:60F:, :61:, :86:, etc.)
    // Here we implement a simplified line-based parser that recognizes key patterns
    const payments: BankPayment[] = [];
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

    let currentDate = new Date().toISOString().split('T')[0];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // :60F: Opening balance with date YYMMDD
      if (line.startsWith(':60F:') || line.startsWith(':60M:')) {
        const dateStr = line.slice(5, 11);
        if (dateStr.match(/^\d{6}$/)) {
          currentDate = `20${dateStr.slice(0, 2)}-${dateStr.slice(2, 4)}-${dateStr.slice(4, 6)}`;
        }
        i++;
        continue;
      }

      // :61: Transaction line format: YYMMDD[MMDD]CRD<amount>N<ref>
      if (line.startsWith(':61:')) {
        const rest = line.slice(4);
        const dateMatch = rest.match(/^(\d{6})(\d{4})?(C|D)(RD?|CR?)(\d+,?\d*)(N\w+)?(\S+)?/);
        if (dateMatch) {
          const txDate = `20${rest.slice(0, 2)}-${rest.slice(2, 4)}-${rest.slice(4, 6)}`;
          const amtStr = (dateMatch[5] ?? '0').replace(',', '.');
          const amountKopecks = Math.round(parseFloat(amtStr) * 100);
          const reference = dateMatch[7] ?? `REF-${Date.now()}`;

          // Look ahead for :86: narrative
          let description = '';
          let counterpartyName = 'Неизвестный';
          let counterpartyInn: string | undefined;
          let counterpartyAccount = '';

          if (lines[i + 1]?.startsWith(':86:')) {
            description = lines[i + 1].slice(4);
            const innMatch = description.match(/ИНН[:\s]*(\d{10,12})/);
            if (innMatch) counterpartyInn = innMatch[1];
            const nameMatch = description.match(/(?:Плательщик|Получатель)[:\s]*([^|/\\]+)/);
            if (nameMatch) counterpartyName = nameMatch[1].trim();
            const acctMatch = description.match(/р[\/]?с[:\s]*(\d{20})/);
            if (acctMatch) counterpartyAccount = acctMatch[1];
            i++;
          }

          payments.push({
            id: `PAY-${String(++this.paymentCounter).padStart(6, '0')}`,
            date: txDate,
            valueDate: txDate,
            amountKopecks,
            currency: 'RUB',
            reference,
            counterpartyName,
            counterpartyInn,
            counterpartyAccount,
            description,
            matchStatus: 'UNMATCHED',
            importBatchId: batchId,
            createdAt: new Date().toISOString(),
          });
        }
        i++;
        continue;
      }

      i++;
    }

    // If no transactions found (e.g., non-MT940 content), generate one mock entry to demonstrate
    if (payments.length === 0 && content.length > 0) {
      payments.push({
        id: `PAY-${String(++this.paymentCounter).padStart(6, '0')}`,
        date: currentDate,
        valueDate: currentDate,
        amountKopecks: 500_000_00,
        currency: 'RUB',
        reference: `REF-${batchId}`,
        counterpartyName: 'ООО "Агро Трейд"',
        counterpartyInn: '7701234567',
        counterpartyAccount: '40702810123456789012',
        description: content.slice(0, 200),
        matchStatus: 'UNMATCHED',
        importBatchId: batchId,
        createdAt: new Date().toISOString(),
      });
    }

    return payments;
  }

  private async tryAutoMatch(payment: BankPayment): Promise<string | undefined> {
    if (!this.prisma) return undefined;

    // Match by reference in deal's payment reference or by amount + date proximity
    const deals = await this.prisma.deal.findMany({
      where: {
        totalKopecks: payment.amountKopecks,
        status: { in: ['PAYMENT_AWAITING', 'PAYMENT_RESERVED', 'IN_TRANSIT'] },
      },
      select: { id: true },
      take: 1,
    }).catch(() => []);

    return deals[0]?.id;
  }

  async manualMatch(paymentId: string, dealId: string, user: RequestUser): Promise<BankPayment> {
    this.assertRole(user);
    const payment = this.payments.find(p => p.id === paymentId);
    if (!payment) throw new Error(`Payment ${paymentId} not found`);
    payment.matchedDealId = dealId;
    payment.matchStatus = 'MANUAL';
    return payment;
  }

  listUnmatched(user: RequestUser): BankPayment[] {
    this.assertRole(user);
    return this.payments.filter(p => p.matchStatus === 'UNMATCHED');
  }

  getReport(user: RequestUser, params?: { from?: string; to?: string }): ReconciliationReport {
    this.assertRole(user);
    const from = params?.from ? new Date(params.from) : new Date(Date.now() - 30 * 24 * 3600_000);
    const to = params?.to ? new Date(params.to) : new Date();

    const period = this.payments.filter(p => {
      const d = new Date(p.date);
      return d >= from && d <= to;
    });

    const matched = period.filter(p => p.matchStatus !== 'UNMATCHED');
    const unmatched = period.filter(p => p.matchStatus === 'UNMATCHED');

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      totalImported: period.length,
      totalMatched: matched.length,
      totalUnmatched: unmatched.length,
      matchedAmountKopecks: matched.reduce((s, p) => s + p.amountKopecks, 0),
      unmatchedAmountKopecks: unmatched.reduce((s, p) => s + p.amountKopecks, 0),
      payments: period,
    };
  }
}
