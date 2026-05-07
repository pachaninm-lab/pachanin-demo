import type { AuditEvent, SupportCase, UserRole } from '../types';
import { canSee } from './role-visibility-engine';

export interface SupportActionFeedback {
  readonly supportCaseId: string;
  readonly statusText: string;
  readonly nextVisibleState: string;
  readonly auditEvent: Pick<AuditEvent, 'entityType' | 'entityId' | 'actorRole' | 'action' | 'reason'>;
}

function isSupportCaseVisibleForRole(supportCase: SupportCase, role: UserRole): boolean {
  if (!canSee(role, 'support')) return false;
  if (role === 'driver') return false;
  if (role === 'investor') return false;
  if (role === 'bank') return supportCase.category === 'money' || supportCase.category === 'documents' || supportCase.category === 'dispute';
  if (role === 'logistics') return supportCase.category === 'logistics' || supportCase.relatedEntityType === 'logistics_order';
  if (role === 'elevator') return supportCase.category === 'elevator' || supportCase.category === 'weight' || supportCase.category === 'quality';
  if (role === 'lab') return supportCase.category === 'lab' || supportCase.category === 'quality';
  return true;
}

export function createSupportActionFeedback(supportCase: SupportCase): SupportActionFeedback {
  const responsibleRole = supportCase.nextActionRole ?? supportCase.requesterRole;

  return {
    supportCaseId: supportCase.id,
    statusText:
      supportCase.status === 'open'
        ? 'Обращение связано с объектом сделки и ожидает действия.'
        : 'Обращение уже находится в обработке или закрытии.',
    nextVisibleState: supportCase.nextActionTitle ?? supportCase.suggestedResolution,
    auditEvent: {
      entityType: 'support_case',
      entityId: supportCase.id,
      actorRole: responsibleRole,
      action: supportCase.nextActionTitle ?? 'Назначить действие по обращению',
      reason: `Категория: ${supportCase.category}. Приоритет: ${supportCase.priority}. Объект: ${supportCase.relatedEntityType} ${supportCase.relatedEntityId}.`,
    },
  };
}

export function createSupportActionFeedbackList(cases: readonly SupportCase[]): SupportActionFeedback[] {
  return cases.map(createSupportActionFeedback);
}

export function createSupportActionFeedbackListForRole(cases: readonly SupportCase[], role: UserRole): SupportActionFeedback[] {
  return cases.filter((supportCase) => isSupportCaseVisibleForRole(supportCase, role)).map(createSupportActionFeedback);
}
