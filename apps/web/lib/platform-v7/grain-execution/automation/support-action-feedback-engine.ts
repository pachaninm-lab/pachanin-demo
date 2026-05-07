import type { AuditEvent, SupportCase } from '../types';

export interface SupportActionFeedback {
  readonly supportCaseId: string;
  readonly statusText: string;
  readonly nextVisibleState: string;
  readonly auditEvent: Pick<AuditEvent, 'entityType' | 'entityId' | 'actorRole' | 'action' | 'reason'>;
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
