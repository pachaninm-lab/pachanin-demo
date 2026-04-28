import {
  allExecutionActionSpecs,
  type ExecutionActionId,
} from './execution-state-machine';

// ─── Legacy action registry ───────────────────────────────────────────────────

export type LegacyActionId =
  | 'startDocs'
  | 'completeDocs'
  | 'requestRelease'
  | 'releaseFunds'
  | 'openDispute'
  | 'resolveDispute'
  | 'manualReview'
  | 'retryWebhook';

export interface LegacyActionEntry {
  readonly actionId: LegacyActionId;
  readonly mode: 'legacy';
  readonly scope: string;
  readonly targetIds: readonly string[];
  readonly note: string;
}

export const LEGACY_ACTION_REGISTRY: readonly LegacyActionEntry[] = [
  { actionId: 'startDocs', mode: 'legacy', scope: 'deal', targetIds: ['deal-start-docs', 'ct-start-docs', 'lots-start-docs'], note: 'Запуск сбора документов — legacy E03' },
  { actionId: 'completeDocs', mode: 'legacy', scope: 'deal', targetIds: ['deal-complete-docs', 'ct-complete-docs', 'elevator-complete-docs'], note: 'Подтверждение документов — legacy E03' },
  { actionId: 'requestRelease', mode: 'legacy', scope: 'deal', targetIds: ['deal-request-release', 'ct-request-release', 'bank-request-release'], note: 'Запрос выпуска — legacy E03; заменяется requestReleaseAfterGates в E4/E5' },
  { actionId: 'releaseFunds', mode: 'legacy', scope: 'bank', targetIds: ['deal-release-funds', 'bank-release-funds'], note: 'ОСТОРОЖНО: legacy releaseFunds — не используется как fake-release в E4/E5' },
  { actionId: 'openDispute', mode: 'legacy', scope: 'dispute', targetIds: ['deal-open-dispute', 'ct-open-dispute', 'dispute-open', 'lab-open-dispute'], note: 'Открытие спора — legacy E03; state machine использует disputeOpen state' },
  { actionId: 'resolveDispute', mode: 'legacy', scope: 'dispute', targetIds: ['deal-resolve-dispute', 'dispute-resolve'], note: 'Legacy resolveDispute — не конфликтует с SM resolveDispute (разные уровни)' },
  { actionId: 'manualReview', mode: 'legacy', scope: 'bank', targetIds: ['bank-manual-approve', 'bank-manual-reject'], note: 'Ручная банковая проверка — legacy E03' },
  { actionId: 'retryWebhook', mode: 'legacy', scope: 'bank', targetIds: ['bank-webhook-retry'], note: 'Повтор webhook — legacy E03' },
];

// ─── Combined registry view ───────────────────────────────────────────────────

export interface ExecutionActionCoreEntry {
  readonly actionId: ExecutionActionId | LegacyActionId;
  readonly label: string;
  readonly mode: 'controlled-pilot' | 'manual' | 'legacy';
  readonly scope: string;
  readonly allowedRoles: readonly string[];
  readonly hasTarget: boolean;
  readonly isLive: false;
}

export function executionActionCoreEntries(): ExecutionActionCoreEntry[] {
  const smEntries: ExecutionActionCoreEntry[] = allExecutionActionSpecs().map((spec) => ({
    actionId: spec.actionId,
    label: spec.label,
    mode: spec.mode,
    scope: spec.scope,
    allowedRoles: spec.allowedRoles,
    hasTarget: true,
    isLive: false as const,
  }));

  const legacyEntries: ExecutionActionCoreEntry[] = LEGACY_ACTION_REGISTRY.map((entry) => ({
    actionId: entry.actionId,
    label: entry.actionId,
    mode: entry.mode,
    scope: entry.scope,
    allowedRoles: [],
    hasTarget: entry.targetIds.length > 0,
    isLive: false as const,
  }));

  return [...smEntries, ...legacyEntries];
}

// Guards the "releaseFunds is not a fake E4/E5 release" invariant.
// releaseFunds is always legacy; no SM entry must claim controlled-pilot for it.
export function isReleaseFundsUsedAsControlledPilot(): boolean {
  const entries = executionActionCoreEntries();
  return entries.some((e) => e.actionId === 'releaseFunds' && e.mode === 'controlled-pilot');
}

// Guards the "openDispute vs SM resolveDispute don't conflict" invariant.
export function disputeActionsConflict(): boolean {
  const legacyOpen = LEGACY_ACTION_REGISTRY.find((e) => e.actionId === 'openDispute');
  const legacyResolve = LEGACY_ACTION_REGISTRY.find((e) => e.actionId === 'resolveDispute');
  const smSpecs = allExecutionActionSpecs();
  const smResolve = smSpecs.find((s) => s.actionId === 'resolveDispute');

  if (!legacyOpen || !legacyResolve || !smResolve) return false;
  // Conflict if SM resolveDispute uses same targetIds as legacy
  return legacyResolve.targetIds.some((tid) => smResolve.fromStates.includes(tid as never));
}
