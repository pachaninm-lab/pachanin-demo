import type { PriceBasis, SdizGate, SdizOperationType, UserRole } from '../types';

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

export function getSdizGateBlockers(gates: readonly SdizGate[]) {
  return gates
    .filter((gate) => gate.required && !['signed', 'sent', 'redeemed', 'partially_redeemed', 'not_required'].includes(gate.status))
    .map((gate) => ({
      id: `${gate.id}-block`,
      type: 'sdiz' as const,
      severity: gate.status === 'error' ? ('critical' as const) : ('warning' as const),
      title: 'СДИЗ требует действия',
      description: gate.errorMessage ?? 'Статус СДИЗ не позволяет продолжить действие без проверки.',
      blocks: gate.blockingMoneyRelease
        ? ('money_release' as const)
        : gate.blockingShipment
          ? ('shipment' as const)
          : gate.blockingDealCreation
            ? ('deal_creation' as const)
            : ('lot_publication' as const),
      responsibleRole: gate.responsibleRole,
      relatedEntityType: 'sdiz_gate',
      relatedEntityId: gate.id,
    }));
}
