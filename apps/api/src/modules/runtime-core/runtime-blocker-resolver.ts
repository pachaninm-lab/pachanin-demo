/**
 * RuntimeCore decomposition — Step 3: BlockerResolver.
 *
 * Read-only derivation of deal blockers, owner and next action, plus shipment
 * blockers. Extracted verbatim from RuntimeCoreService. Stateless and
 * source-agnostic: it works on a snapshot passed in and never reaches into
 * RuntimeCore's in-memory store, so the same engine can later run over
 * DB-sourced snapshots (scaling target) without a rewrite. No writes, no side
 * effects — outputs are identical to the previous inline logic, which matters
 * because `refreshDealRuntime` consumes owner / next-action / blockers.
 * Controlled-pilot / pre-integration.
 */

/** Minimal deal-state snapshot the resolver needs (structurally satisfied by runtime objects). */
export interface DealStateSnapshot {
  deal: { status: string; owner?: string | null; nextAction?: string | null };
  payment: { status: string; callbackState?: string | null };
  completeness: { isComplete: boolean; missing: string[] };
  shipment?: { status: string; handoff?: { lab?: boolean } } | null;
  sample?: { status: string } | null;
}

/** Minimal shipment snapshot for shipment-level blockers. */
export interface ShipmentBlockerSnapshot {
  pinVerified?: boolean;
  checkpoints: unknown[];
  handoff: { receiving?: boolean };
  status: string;
}

const FINAL_SAMPLE_STATUSES = ['FINALIZED', 'ANALYZED'];
const SHIPMENT_HANDED_OFF = ['AT_UNLOADING', 'DELIVERED', 'COMPLETED'];
const BANK_OWNER_PAYMENT_STATUSES = ['RESERVE_PENDING', 'CALLBACK_PENDING', 'MISMATCH', 'MANUAL_REVIEW'];

/** Stateless blocker/owner/next-action engine. Holds no state; safe to reuse. */
export class RuntimeBlockerResolver {
  /** Who currently owns the deal (human queue). */
  resolveOwner(s: DealStateSnapshot): string {
    if (s.deal.status === 'DISPUTE_OPEN') return 'Контроль';
    if (s.deal.status === 'QUALITY_CHECK') return 'Лаборатория';
    if (s.shipment && ['IN_TRANSIT', 'AT_UNLOADING'].includes(s.shipment.status)) return 'Логистика';
    if (!s.completeness.isComplete) return 'Документы';
    if (BANK_OWNER_PAYMENT_STATUSES.includes(s.payment.status)) return 'Банк';
    return s.deal.owner ?? 'Сделка';
  }

  /** The next human action prompt for the deal. */
  resolveNextAction(s: DealStateSnapshot): string {
    if (s.payment.status === 'RESERVE_PENDING') return 'Дождаться callback по резерву';
    if (!s.completeness.isComplete) return `Закрыть документы: ${s.completeness.missing.join(', ')}`;
    if (s.shipment && s.shipment.status === 'AT_UNLOADING' && !s.shipment.handoff?.lab) {
      return 'Передать партию в лабораторию';
    }
    if (!s.sample || !FINAL_SAMPLE_STATUSES.includes(s.sample.status)) {
      return 'Финализировать лабораторный протокол';
    }
    if (s.payment.status === 'READY_FOR_RELEASE') return 'Выпустить деньги или подтвердить release';
    if (s.payment.status === 'MISMATCH') return 'Открыть ручную сверку';
    return s.deal.nextAction ?? 'Продолжить исполнение сделки';
  }

  /** The list of release-gating blockers for the deal. */
  resolveBlockers(s: DealStateSnapshot): string[] {
    const blockers: string[] = [];
    if (s.payment.callbackState === 'PENDING') blockers.push('Нет callback банка');
    if (!s.completeness.isComplete) blockers.push(`Нет документов: ${s.completeness.missing.join(', ')}`);
    if (s.shipment && !SHIPMENT_HANDED_OFF.includes(s.shipment.status)) blockers.push('Рейс не передан в приёмку');
    if (!s.sample || !FINAL_SAMPLE_STATUSES.includes(s.sample.status)) blockers.push('Нет финального протокола качества');
    if (s.deal.status === 'DISPUTE_OPEN') blockers.push('Есть открытый спор');
    if (s.payment.status === 'MISMATCH') blockers.push('Есть банковое расхождение');
    return blockers;
  }

  /** Shipment-level blockers (driver pin, checkpoints, handoff). */
  resolveShipmentBlockers(s: ShipmentBlockerSnapshot): string[] {
    const blockers: string[] = [];
    if (!s.pinVerified) blockers.push('ПИН водителя не подтверждён');
    if (!s.checkpoints.length) blockers.push('Нет контрольных точек');
    if (!s.handoff.receiving && s.status === 'AT_UNLOADING') blockers.push('Нет передачи в приёмку');
    return blockers;
  }
}
