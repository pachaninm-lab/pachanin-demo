import type { ExecutionBlocker, PriceBasis, SdizGate, SdizOperationType, UserRole } from '../types';

const basisOperations: Record<PriceBasis, readonly SdizOperationType[]> = {
  EXW: ['realization'],
  FCA: ['realization', 'shipment'],
  CPT: ['realization', 'shipment', 'transportation', 'acceptance'],
  DAP: ['realization', 'shipment', 'transportation', 'acceptance'],
  FOB: ['realization', 'shipment'],
};

function responsibleRoleFor(basis: PriceBasis, operationType: SdizOperationType): UserRole {
  if (basis === 'EXW' && operationType !== 'realization') return 'buyer';
  if (operationType === 'acceptance') return 'buyer';
  return 'seller';
}

function isSdizGateSatisfied(gate: SdizGate): boolean {
  return ['sent', 'redeemed', 'partially_redeemed', 'not_required'].includes(gate.status);
}

function sdizBlockerSeverity(gate: SdizGate): ExecutionBlocker['severity'] {
  return gate.status === 'error' || gate.status === 'manual_review' ? 'critical' : 'warning';
}

function sdizBlockerDescription(gate: SdizGate, block: ExecutionBlocker['blocks']): string {
  if (gate.errorMessage) return gate.errorMessage;
  if (gate.status === 'manual_review') return 'СДИЗ отправлен на ручную сверку. Продолжение этапа требует подтверждения ответственного контура.';
  if (block === 'shipment') return 'СДИЗ не позволяет начинать или продолжать отгрузку без подтверждённого статуса.';
  if (block === 'acceptance') return 'СДИЗ не позволяет закрыть приёмку без подтверждённого статуса.';
  if (block === 'money_release') return 'СДИЗ не позволяет выпуск денег без подтверждённого статуса.';
  if (block === 'deal_creation') return 'СДИЗ не позволяет создать сделку без подтверждённого статуса.';
  return 'СДИЗ не позволяет продолжить действие без проверки.';
}

export function buildSdizGates(params: {
  readonly batchId: string;
  readonly dealId?: string;
  readonly logisticsOrderId?: string;
  readonly routeLegId?: string;
  readonly basis: PriceBasis;
  readonly responsibleSellerId: string;
  readonly responsibleBuyerId?: string;
  readonly volumeTons: number;
  readonly createdAt: string;
}): SdizGate[] {
  return basisOperations[params.basis].map((operationType) => {
    const responsibleRole = responsibleRoleFor(params.basis, operationType);
    const responsiblePartyId = responsibleRole === 'buyer' ? (params.responsibleBuyerId ?? params.responsibleSellerId) : params.responsibleSellerId;
    const blocksShipment = operationType === 'shipment' || operationType === 'transportation';
    const blocksAcceptance = operationType === 'acceptance' || operationType === 'transportation';
    return {
      id: `SDIZ-${params.batchId}-${operationType}`,
      dealId: params.dealId,
      batchId: params.batchId,
      logisticsOrderId: params.logisticsOrderId,
      routeLegId: params.routeLegId,
      basis: params.basis,
      operationType,
      responsibleRole,
      responsiblePartyId,
      required: true,
      status: 'required',
      expectedVolumeTons: params.volumeTons,
      blockingLotPublication: operationType === 'realization',
      blockingDealCreation: operationType === 'realization',
      blockingShipment: blocksShipment,
      blockingAcceptance: blocksAcceptance,
      blockingMoneyRelease: true,
      maturity: 'sandbox',
      createdAt: params.createdAt,
      updatedAt: params.createdAt,
    } satisfies SdizGate;
  });
}

function sdizStageBlocks(gate: SdizGate): ExecutionBlocker['blocks'][] {
  return [
    gate.blockingLotPublication ? 'lot_publication' : null,
    gate.blockingDealCreation ? 'deal_creation' : null,
    gate.blockingShipment ? 'shipment' : null,
    gate.blockingAcceptance ? 'acceptance' : null,
    gate.blockingMoneyRelease ? 'money_release' : null,
  ].filter((block): block is ExecutionBlocker['blocks'] => Boolean(block));
}

export function getSdizGateBlockers(gates: readonly SdizGate[]): ExecutionBlocker[] {
  return gates.flatMap((gate) => {
    if (!gate.required || isSdizGateSatisfied(gate)) return [];

    return sdizStageBlocks(gate).map((block) => ({
      id: `${gate.id}-${block}-block`,
      type: 'sdiz' as const,
      severity: sdizBlockerSeverity(gate),
      title: 'СДИЗ требует действия',
      description: sdizBlockerDescription(gate, block),
      blocks: block,
      responsibleRole: gate.responsibleRole,
      relatedEntityType: 'sdiz_gate',
      relatedEntityId: gate.id,
    }));
  });
}
