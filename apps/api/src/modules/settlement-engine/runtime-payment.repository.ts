import { Injectable } from '@nestjs/common';
import type { PaymentRepository } from './payment.repository';
import { RuntimeCoreService } from '../runtime-core/runtime-core.service';

/**
 * Default payment read adapter.
 *
 * Wraps the in-memory RuntimeCore payment read methods without changing
 * behavior. This is the only active adapter in controlled-pilot mode.
 */
@Injectable()
export class RuntimePaymentRepository implements PaymentRepository {
  constructor(private readonly runtime: RuntimeCoreService) {}

  async list(): Promise<unknown[]> {
    return this.runtime.listPayments();
  }

  async detail(id: string): Promise<any> {
    return this.runtime.paymentDetail(id);
  }

  worksheet(dealId: string): any {
    return this.runtime.worksheet(dealId);
  }

  bankWorkspace(dealId: string): any {
    return this.runtime.bankWorkspace(dealId);
  }
}
