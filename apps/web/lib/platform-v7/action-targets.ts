import type { PlatformV7ActionMessageId } from './action-messages';
import type { PlatformActionScope } from './action-log';
import type { PlatformV7DealWorkspaceActionId } from './deal-workspace-actions';

export type PlatformV7ActionSurface =
  | 'control-tower'
  | 'deal-detail'
  | 'bank'
  | 'bank-manual-review'
  | 'bank-webhooks'
  | 'disputes'
  | 'lab'
  | 'elevator'
  | 'lots';

export interface PlatformV7ActionTarget {
  id: string;
  surface: PlatformV7ActionSurface;
  actionId: PlatformV7ActionMessageId;
  workspaceActionId?: PlatformV7DealWorkspaceActionId;
  scope: PlatformActionScope;
  label: string;
  requiresFeedback: true;
}

export const PLATFORM_V7_ACTION_TARGETS: PlatformV7ActionTarget[] = [
  { id: 'deal-start-docs', surface: 'deal-detail', actionId: 'startDocs', workspaceActionId: 'start-documents', scope: 'deal', label: 'Начать сбор документов', requiresFeedback: true },
  { id: 'deal-complete-docs', surface: 'deal-detail', actionId: 'completeDocs', workspaceActionId: 'complete-documents', scope: 'deal', label: 'Документы собраны', requiresFeedback: true },
  { id: 'deal-request-release', surface: 'deal-detail', actionId: 'requestRelease', workspaceActionId: 'request-release', scope: 'deal', label: 'Запросить выпуск денег', requiresFeedback: true },
  { id: 'deal-release-funds', surface: 'deal-detail', actionId: 'releaseFunds', workspaceActionId: 'release-funds', scope: 'bank', label: 'Выпустить деньги', requiresFeedback: true },
  { id: 'deal-open-dispute', surface: 'deal-detail', actionId: 'openDispute', workspaceActionId: 'open-dispute', scope: 'dispute', label: 'Открыть спор', requiresFeedback: true },
  { id: 'deal-resolve-dispute', surface: 'deal-detail', actionId: 'resolveDispute', workspaceActionId: 'resolve-dispute', scope: 'dispute', label: 'Закрыть спор', requiresFeedback: true },
  { id: 'ct-start-docs', surface: 'control-tower', actionId: 'startDocs', workspaceActionId: 'start-documents', scope: 'deal', label: 'Запустить документы', requiresFeedback: true },
  { id: 'ct-complete-docs', surface: 'control-tower', actionId: 'completeDocs', workspaceActionId: 'complete-documents', scope: 'deal', label: 'Подтвердить документы', requiresFeedback: true },
  { id: 'ct-request-release', surface: 'control-tower', actionId: 'requestRelease', workspaceActionId: 'request-release', scope: 'deal', label: 'Запросить выпуск', requiresFeedback: true },
  { id: 'ct-open-dispute', surface: 'control-tower', actionId: 'openDispute', workspaceActionId: 'open-dispute', scope: 'dispute', label: 'Открыть спор', requiresFeedback: true },
  { id: 'bank-release-funds', surface: 'bank', actionId: 'releaseFunds', workspaceActionId: 'release-funds', scope: 'bank', label: 'Выпустить деньги', requiresFeedback: true },
  { id: 'bank-request-release', surface: 'bank', actionId: 'requestRelease', workspaceActionId: 'request-release', scope: 'bank', label: 'Запросить выпуск', requiresFeedback: true },
  { id: 'bank-manual-approve', surface: 'bank-manual-review', actionId: 'manualReview', scope: 'bank', label: 'Одобрить проверку', requiresFeedback: true },
  { id: 'bank-manual-reject', surface: 'bank-manual-review', actionId: 'manualReview', scope: 'bank', label: 'Отклонить проверку', requiresFeedback: true },
  { id: 'bank-webhook-retry', surface: 'bank-webhooks', actionId: 'retryWebhook', scope: 'bank', label: 'Повторить webhook', requiresFeedback: true },
  { id: 'dispute-open', surface: 'disputes', actionId: 'openDispute', workspaceActionId: 'open-dispute', scope: 'dispute', label: 'Открыть спор', requiresFeedback: true },
  { id: 'dispute-resolve', surface: 'disputes', actionId: 'resolveDispute', workspaceActionId: 'resolve-dispute', scope: 'dispute', label: 'Закрыть спор', requiresFeedback: true },
  { id: 'lab-open-dispute', surface: 'lab', actionId: 'openDispute', workspaceActionId: 'open-dispute', scope: 'lab', label: 'Открыть спор по качеству', requiresFeedback: true },
  { id: 'elevator-complete-docs', surface: 'elevator', actionId: 'completeDocs', workspaceActionId: 'complete-documents', scope: 'elevator', label: 'Подтвердить приёмку', requiresFeedback: true },
  { id: 'lots-start-docs', surface: 'lots', actionId: 'startDocs', workspaceActionId: 'start-documents', scope: 'lot', label: 'Запустить документы по лоту', requiresFeedback: true },
];

export function platformV7ActionTargets(surface?: PlatformV7ActionSurface): PlatformV7ActionTarget[] {
  return surface ? PLATFORM_V7_ACTION_TARGETS.filter((target) => target.surface === surface) : PLATFORM_V7_ACTION_TARGETS;
}

export function platformV7ActionTargetById(id: string): PlatformV7ActionTarget | null {
  return PLATFORM_V7_ACTION_TARGETS.find((target) => target.id === id) ?? null;
}

export function platformV7ActionTargetsWithWorkspaceBridge(): PlatformV7ActionTarget[] {
  return PLATFORM_V7_ACTION_TARGETS.filter((target) => target.workspaceActionId);
}
