import { BadRequestException } from '@nestjs/common';

/**
 * RuntimeCore decomposition — Step 1: StateMachine.
 *
 * Pure transition legality for the deal and shipment lifecycles, extracted
 * verbatim from RuntimeCoreService. No state reads/writes, no side effects —
 * the maps and the thrown messages are identical to the previous inline logic,
 * so behavior is unchanged. Controlled-pilot / pre-integration.
 */

/** Deal lifecycle transition map — the single source of deal status legality. */
export const DEAL_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['AWAITING_SIGN', 'CANCELLATION'],
  AWAITING_SIGN: ['SIGNED', 'CANCELLATION'],
  SIGNED: ['PREPAYMENT_RESERVED', 'DISPUTE_OPEN', 'CANCELLATION'],
  PREPAYMENT_RESERVED: ['LOADING', 'DISPUTE_OPEN'],
  LOADING: ['IN_TRANSIT', 'DISPUTE_OPEN'],
  IN_TRANSIT: ['ARRIVED', 'DISPUTE_OPEN'],
  ARRIVED: ['QUALITY_CHECK', 'DISPUTE_OPEN'],
  QUALITY_CHECK: ['ACCEPTED', 'DISPUTE_OPEN', 'EXPERTISE'],
  ACCEPTED: ['FINAL_PAYMENT', 'PARTIAL_SETTLEMENT', 'DISPUTE_OPEN'],
  PARTIAL_SETTLEMENT: ['FINAL_PAYMENT', 'DISPUTE_OPEN'],
  FINAL_PAYMENT: ['SETTLED', 'DISPUTE_OPEN'],
  SETTLED: ['CLOSED'],
  DISPUTE_OPEN: ['EXPERTISE', 'ARBITRATION_DECISION', 'PARTIAL_SETTLEMENT'],
  EXPERTISE: ['ARBITRATION_DECISION', 'PARTIAL_SETTLEMENT'],
  ARBITRATION_DECISION: ['FINAL_PAYMENT', 'CANCELLATION', 'PARTIAL_SETTLEMENT'],
};

/** Shipment lifecycle transition map. */
export const SHIPMENT_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['AT_UNLOADING', 'ROUTE_DEVIATION_ALERT', 'CANCELLED'],
  AT_UNLOADING: ['DELIVERED', 'COMPLETED', 'CANCELLED'],
  ROUTE_DEVIATION_ALERT: ['IN_TRANSIT', 'CANCELLED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Transition legality engine for RuntimeCore. Stateless — safe to instantiate
 * once and reuse. Throws the same `BadRequestException` messages as before.
 */
export class RuntimeStateMachine {
  /** Throws if the deal `from → to` transition is not allowed. */
  assertDealTransition(from: string, to: string): void {
    if (!(DEAL_TRANSITIONS[from] ?? []).includes(to)) {
      throw new BadRequestException(`Переход ${from} → ${to} не разрешён`);
    }
  }

  /** Allowed next shipment states from the current status (empty if terminal/unknown). */
  availableShipmentTransitions(status: string): string[] {
    return SHIPMENT_TRANSITIONS[status] ?? [];
  }

  /** Throws if the shipment `from → to` transition is not allowed. */
  assertShipmentTransition(from: string, to: string): void {
    if (!this.availableShipmentTransitions(from).includes(to)) {
      throw new BadRequestException(`Переход рейса ${from} → ${to} не разрешён`);
    }
  }
}
