import { Injectable } from '@nestjs/common';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';

@Injectable()
export class SettlementEngineService {
  constructor(private readonly runtime: RuntimeCoreService) {}

  worksheet(dealId: string) {
    return this.runtime.worksheet(dealId);
  }

  bankWorkspace(dealId: string) {
    return this.runtime.bankWorkspace(dealId);
  }

  listPayments(_user: any) {
    return this.runtime.listPayments();
  }

  paymentDetail(id: string, _user: any) {
    return this.runtime.paymentDetail(id);
  }

  async exportDeals(_params: any, _user: any) {
    const payments = this.runtime.listPayments();
    const rows = [['dealId', 'status', 'amountRub', 'callbackState'], ...payments.map((p: any) => [p.dealId, p.status, String(p.amountRub), p.callbackState ?? ''])];
    return {
      contentType: 'text/csv',
      fileName: 'deals-export.csv',
      body: rows.map((row) => row.join(',')).join('\n'),
    };
  }

  async exportContractors(_user: any) {
    const rows = [['dealId', 'beneficiaryId', 'role', 'bankStatus']];
    for (const payment of this.runtime.listPayments()) {
      const bank = this.runtime.bankWorkspace(payment.dealId);
      for (const beneficiary of bank.beneficiaries) {
        rows.push([payment.dealId, beneficiary.id, beneficiary.role, beneficiary.bankStatus]);
      }
    }
    return {
      contentType: 'text/csv',
      fileName: 'contractors.csv',
      body: rows.map((row) => row.join(',')).join('\n'),
    };
  }

  confirmWorksheet(dealId: string, user: any) {
    return this.runtime.confirmWorksheet(dealId, user);
  }

  releasePayment(dealId: string, user: any) {
    return this.runtime.releasePayment(dealId, user);
  }

  adjustWorksheet(dealId: string, adjustments: any[], user: any) {
    return this.runtime.adjustWorksheet(dealId, adjustments, user);
  }

  importBankStatement(content: string, format: string, user: any) {
    return this.runtime.importBankStatement(content, format, user);
  }

  registerSafeDealsCallback(payload: any) {
    return this.runtime.registerSafeDealsCallback(payload);
  }
}
