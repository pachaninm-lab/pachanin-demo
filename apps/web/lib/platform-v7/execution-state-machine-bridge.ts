import { PLATFORM_V7_EXECUTION_SOURCE } from './deal-execution-source-of-truth';
import {
  availablePlatformV7ExecutionMachineActions,
  createPlatformV7ExecutionMachineContext,
  mapPlatformV7ExecutionStatusToMachineState,
  type PlatformV7ExecutionMachineActionId,
  type PlatformV7ExecutionMachineContext,
  type PlatformV7ExecutionMachineRole,
} from './execution-state-machine';

export type PlatformV7ExecutionSourceShape = typeof PLATFORM_V7_EXECUTION_SOURCE;

export interface PlatformV7ExecutionMachineBridgeSnapshot {
  readonly dealId: string;
  readonly lotId: string;
  readonly fgisPartyId: string;
  readonly maturity: string;
  readonly context: PlatformV7ExecutionMachineContext;
  readonly blockers: readonly string[];
  readonly availableActions: readonly PlatformV7ExecutionMachineActionId[];
  readonly finalGateReady: boolean;
}

export function createPlatformV7ExecutionMachineContextFromSource(source: PlatformV7ExecutionSourceShape = PLATFORM_V7_EXECUTION_SOURCE): PlatformV7ExecutionMachineContext {
  const base = createPlatformV7ExecutionMachineContext(true);
  const currentLeg = source.logistics.currentLeg.toLowerCase();
  const bankReady = source.readiness.bank.status === 'готово' && source.money.bankDecision === 'готово';
  const docsReady = source.readiness.documents.status === 'готово' && source.documents.missingDocuments.length === 0;
  const sdizReady = source.documents.sdizStatus.toLowerCase().includes('готов') || source.documents.sdizStatus.toLowerCase().includes('оформлен');
  const qualityReady = source.readiness.quality.status === 'готово';
  const disputeOpen = source.dispute.status !== 'готово' || source.dispute.arbitratorNeeded;

  return {
    ...base,
    state: mapPlatformV7ExecutionStatusToMachineState(source.deal.status),
    hasAcceptedOffer: true,
    hasDraftDeal: true,
    hasMoneyReserveIntent: source.money.reservedRub > 0 || source.money.buyerMoneyStatus.toLowerCase().includes('резерв'),
    hasMoneyReserveConfirmed: bankReady,
    hasLogisticsOrder: Boolean(source.logistics.orderId),
    hasLoadingStarted: currentLeg.includes('погрузка начата') || currentLeg.includes('в погрузке'),
    hasArrivedElevator: currentLeg.includes('элеватор') || currentLeg.includes('приёмк'),
    hasQualityCheckStarted: qualityReady || source.readiness.quality.status === 'проверить',
    hasQualityAccepted: qualityReady,
    hasQualityRejected: source.readiness.quality.status === 'стоп',
    hasDocumentsAttached: docsReady,
    hasSdizReady: sdizReady,
    hasOpenDispute: disputeOpen,
  };
}

export function platformV7MachineFinalGateReady(ctx: PlatformV7ExecutionMachineContext): boolean {
  return ctx.hasMoneyReserveConfirmed && ctx.hasQualityAccepted && ctx.hasDocumentsAttached && ctx.hasSdizReady && !ctx.hasOpenDispute;
}

export function platformV7MachineBlockers(ctx: PlatformV7ExecutionMachineContext): string[] {
  const blockers: string[] = [];
  if (!ctx.hasMoneyReserveConfirmed) blockers.push('reserve_not_confirmed');
  if (!ctx.hasQualityAccepted) blockers.push('quality_not_accepted');
  if (!ctx.hasDocumentsAttached) blockers.push('documents_missing');
  if (!ctx.hasSdizReady) blockers.push('sdiz_missing');
  if (ctx.hasOpenDispute) blockers.push('dispute_open');
  return blockers;
}

export function createPlatformV7ExecutionMachineBridgeSnapshot(
  source: PlatformV7ExecutionSourceShape = PLATFORM_V7_EXECUTION_SOURCE,
  actorRole: PlatformV7ExecutionMachineRole = 'operator',
): PlatformV7ExecutionMachineBridgeSnapshot {
  const context = createPlatformV7ExecutionMachineContextFromSource(source);
  return {
    dealId: source.deal.id,
    lotId: source.deal.lotId,
    fgisPartyId: source.deal.fgisPartyId,
    maturity: source.deal.maturity,
    context,
    blockers: platformV7MachineBlockers(context),
    availableActions: availablePlatformV7ExecutionMachineActions(context, actorRole),
    finalGateReady: platformV7MachineFinalGateReady(context),
  };
}
