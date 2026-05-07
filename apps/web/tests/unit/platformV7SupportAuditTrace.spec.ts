import { describe, expect, it } from 'vitest';
import { createSupportAuditEvent, supportEscalationTraceDescription } from '@/lib/platform-v7/support-helpers';
import type { SupportCase } from '@/lib/platform-v7/support-types';

const supportCase: SupportCase = {
  id: 'SC-9103',
  title: 'Выпуск денег остановлен из-за незакрытой приёмки',
  description: 'По сделке есть сумма к выпуску, но не закрыты вес и качество.',
  status: 'assigned_operator',
  priority: 'P0',
  category: 'money',
  requesterRole: 'seller',
  relatedEntityType: 'deal',
  relatedEntityId: 'DL-9103',
  dealId: 'DL-9103',
  lotId: 'LOT-9103',
  tripId: 'TR-9103',
  moneyAtRiskRub: 12_840_000,
  blocker: 'Не подтверждены вес и качество после разгрузки',
  owner: 'Оператор сделки',
  nextAction: 'Оператор сверяет приёмку, лабораторию и документный пакет.',
  slaDueAt: '2026-05-05T11:00:00.000Z',
  createdAt: '2026-05-05T08:24:00.000Z',
  updatedAt: '2026-05-05T08:46:00.000Z',
};

describe('platform-v7 support audit trace', () => {
  it('creates stable support audit event ids with case, action and related object', () => {
    const event = createSupportAuditEvent({
      caseId: supportCase.id,
      actor: 'Оператор поддержки',
      action: 'escalated',
      description: 'Обращение эскалировано ответственному контуру.',
      before: 'assigned_operator',
      after: 'escalated',
      createdAt: '2026-05-05T09:00:00.000Z',
      relatedEntityId: supportCase.relatedEntityId,
      sequence: 3,
    });

    expect(event).toEqual({
      id: 'SAE-SC-9103-escalated-DL-9103-3',
      caseId: 'SC-9103',
      actor: 'Оператор поддержки',
      action: 'escalated',
      description: 'Обращение эскалировано ответственному контуру.',
      before: 'assigned_operator',
      after: 'escalated',
      createdAt: '2026-05-05T09:00:00.000Z',
    });
  });

  it('records escalation trace with object, blocker and next action', () => {
    expect(supportEscalationTraceDescription(supportCase, 'escalated')).toBe(
      'Эскалация по Сделка DL-9103: Не подтверждены вес и качество после разгрузки. Следующий шаг: Оператор сверяет приёмку, лабораторию и документный пакет..',
    );
  });

  it('records waiting user and resolved trace without hiding owner context', () => {
    expect(supportEscalationTraceDescription(supportCase, 'waiting_user')).toBe(
      'Запрошены данные по Сделка DL-9103: Не подтверждены вес и качество после разгрузки.',
    );
    expect(supportEscalationTraceDescription(supportCase, 'resolved')).toBe(
      'Подготовлено решение по Сделка DL-9103. Ответственный контур: Оператор сделки.',
    );
  });
});
