import { Injectable, NotFoundException } from '@nestjs/common';
import { buildSettlementSnapshot } from './settlement-calculation';

const PAYMENTS_SEED = [
  {
    id: 'PAY-001',
    dealId: 'DEAL-001',
    status: 'HOLD_ACTIVE',
    amountRub: 6375000,
    holdReason: 'Ожидание проверки качества',
    reasonCode: 'QUALITY_HOLD',
    createdAt: '2026-03-25T12:00:00Z',
  },
  {
    id: 'PAY-002',
    dealId: 'DEAL-002',
    status: 'READY_FOR_RELEASE',
    amountRub: 8625000,
    reasonCode: 'DOCS_COMPLETE',
    createdAt: '2026-03-20T09:00:00Z',
  },
  {
    id: 'PAY-003',
    dealId: 'DEAL-003',
    status: 'PENDING',
    amountRub: 3300000,
    createdAt: '2026-04-01T10:00:00Z',
  },
];

const DEMO_DEALS: Record<string, any> = {
  'DEAL-001': { id: 'DEAL-001', price: 12750, volumeTons: 500, culture: 'wheat', buyerOrgId: 'prov-buyer-1', farmerOrgId: 'prov-farmer-1' },
  'DEAL-002': { id: 'DEAL-002', price: 11500, volumeTons: 750, culture: 'corn', buyerOrgId: 'prov-buyer-2', farmerOrgId: 'prov-farmer-2' },
  'DEAL-003': { id: 'DEAL-003', price: 11000, volumeTons: 300, culture: 'barley', buyerOrgId: 'prov-buyer-3', farmerOrgId: 'prov-farmer-3' },
};

@Injectable()
export class SettlementEngineService {
  private payments: any[] = PAYMENTS_SEED.map((p) => ({ ...p }));

  worksheet(dealId: string) {
    const deal = DEMO_DEALS[dealId];
    if (!deal) {
      return {
        dealId,
        snapshot: buildSettlementSnapshot({ id: dealId, price: 0, volumeTons: 0 }),
        payment: null,
      };
    }
    const snapshot = buildSettlementSnapshot(deal);
    const payment = this.payments.find((p) => p.dealId === dealId) ?? null;
    return { dealId, deal, snapshot, payment };
  }

  listPayments(_user: any) {
    return this.payments;
  }

  paymentDetail(id: string, _user: any) {
    const payment = this.payments.find((p) => p.id === id);
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    const deal = DEMO_DEALS[payment.dealId];
    const snapshot = deal ? buildSettlementSnapshot(deal) : null;
    return { ...payment, snapshot };
  }

  async exportDeals(params: any, _user: any) {
    const rows = [
      ['dealId', 'status', 'amountRub', 'reasonCode', 'createdAt'],
      ...this.payments.map((p) => [p.dealId, p.status, String(p.amountRub), p.reasonCode ?? '', p.createdAt]),
    ];
    const body = rows.map((r) => r.join(',')).join('\n');
    return {
      contentType: 'text/csv',
      fileName: 'deals-export.csv',
      body,
    };
  }

  async exportContractors(_user: any) {
    const rows = [
      ['orgId', 'name', 'role', 'dealsCount'],
      ['prov-buyer-1', 'АгроБайер ООО', 'BUYER', '1'],
      ['prov-buyer-2', 'ЗерноТрейд', 'BUYER', '1'],
      ['prov-farmer-1', 'КФХ Иванов', 'FARMER', '1'],
      ['prov-farmer-2', 'АгроХолдинг Юг', 'FARMER', '1'],
    ];
    const body = rows.map((r) => r.join(',')).join('\n');
    return {
      contentType: 'text/csv',
      fileName: 'contractors.csv',
      body,
    };
  }

  confirmWorksheet(dealId: string, user: any) {
    const payment = this.payments.find((p) => p.dealId === dealId);
    if (payment) {
      payment.status = 'CONFIRMED';
      payment.confirmedAt = new Date().toISOString();
      payment.confirmedByUserId = user?.sub ?? user?.id ?? null;
    }
    return { dealId, confirmed: true, payment: payment ?? null };
  }

  releasePayment(dealId: string, user: any) {
    const payment = this.payments.find((p) => p.dealId === dealId);
    if (payment) {
      payment.status = 'RELEASED';
      payment.releasedAt = new Date().toISOString();
      payment.releasedByUserId = user?.sub ?? user?.id ?? null;
    }
    return { dealId, released: true, payment: payment ?? null };
  }

  adjustWorksheet(dealId: string, adjustments: any[], user: any) {
    const payment = this.payments.find((p) => p.dealId === dealId);
    if (payment) {
      payment.adjustments = adjustments;
      payment.adjustedAt = new Date().toISOString();
      payment.adjustedByUserId = user?.sub ?? user?.id ?? null;
      const delta = adjustments.reduce((sum: number, a: any) => sum + (Number(a.deltaRub) || 0), 0);
      payment.amountRub = payment.amountRub + delta;
    }
    return { dealId, adjustments, payment: payment ?? null };
  }

  importBankStatement(content: string, format: string, user: any) {
    const lines = (content || '').split('\n').filter(Boolean);
    return {
      format: format ?? 'CSV',
      parsedRows: lines.length,
      importedAt: new Date().toISOString(),
      importedByUserId: user?.sub ?? user?.id ?? null,
      status: 'IMPORTED',
    };
  }
}
