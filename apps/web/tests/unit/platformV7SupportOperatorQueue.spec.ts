import { describe, expect, it } from 'vitest';
import { supportLinkedExecutionHref, supportSlaLabel, supportSlaState, supportSortCases } from '@/lib/platform-v7/support-helpers';
import type { SupportCase } from '@/lib/platform-v7/support-types';

const baseCase: SupportCase = {
  id: 'SUP-BASE',
  title: 'Базовое обращение',
  description: 'Проверка обращения',
  status: 'created',
  priority: 'P2',
  category: 'documents',
  requesterRole: 'operator',
  relatedEntityType: 'deal',
  relatedEntityId: 'DL-BASE',
  dealId: 'DL-BASE',
  moneyAtRiskRub: 0,
  blocker: 'Нет владельца следующего шага',
  owner: 'Оператор сделки',
  nextAction: 'Назначить владельца',
  slaDueAt: '2026-05-05T16:00:00.000Z',
  createdAt: '2026-05-05T09:00:00.000Z',
  updatedAt: '2026-05-05T09:00:00.000Z',
};

function supportCase(overrides: Partial<SupportCase>): SupportCase {
  return { ...baseCase, ...overrides };
}

describe('platform-v7 support operator queue helpers', () => {
  it('sorts operator queue by breached SLA, then priority, due time and money at risk', () => {
    const openHighMoney = supportCase({ id: 'SUP-OPEN-HIGH-MONEY', priority: 'P1', moneyAtRiskRub: 900_000, slaDueAt: '2026-05-05T18:00:00.000Z' });
    const breachedLow = supportCase({ id: 'SUP-BREACHED-LOW', priority: 'P3', slaDueAt: '2026-05-05T08:00:00.000Z' });
    const dueSoonP1 = supportCase({ id: 'SUP-DUE-SOON-P1', priority: 'P1', slaDueAt: '2026-05-05T13:00:00.000Z' });
    const dueSoonP0 = supportCase({ id: 'SUP-DUE-SOON-P0', priority: 'P0', slaDueAt: '2026-05-05T13:30:00.000Z' });
    const closedP0 = supportCase({ id: 'SUP-CLOSED', status: 'resolved', priority: 'P0', slaDueAt: '2026-05-05T07:00:00.000Z' });

    expect(supportSortCases([openHighMoney, breachedLow, dueSoonP1, dueSoonP0, closedP0]).map((item) => item.id)).toEqual([
      'SUP-BREACHED-LOW',
      'SUP-DUE-SOON-P0',
      'SUP-DUE-SOON-P1',
      'SUP-OPEN-HIGH-MONEY',
      'SUP-CLOSED',
    ]);
  });

  it('labels SLA state without hiding breached or closed cases', () => {
    expect(supportSlaState(supportCase({ slaDueAt: '2026-05-05T11:00:00.000Z' }))).toBe('breached');
    expect(supportSlaLabel(supportCase({ slaDueAt: '2026-05-05T13:00:00.000Z' }))).toBe('SLA скоро истечёт');
    expect(supportSlaLabel(supportCase({ status: 'closed', slaDueAt: '2026-05-05T09:00:00.000Z' }))).toBe('SLA закрыт');
  });

  it('builds linked execution routes from explicit related object type first', () => {
    expect(supportLinkedExecutionHref(supportCase({ relatedEntityType: 'deal', relatedEntityId: 'DL-9102', dealId: 'DL-9102' }))).toBe('/platform-v7/deals/DL-9102');
    expect(supportLinkedExecutionHref(supportCase({ relatedEntityType: 'trip', relatedEntityId: 'TRIP-9', dealId: 'DL-9102', tripId: 'TRIP-9' }))).toBe('/platform-v7/logistics/trips/TRIP-9');
    expect(supportLinkedExecutionHref(supportCase({ relatedEntityType: 'document', relatedEntityId: 'DOC-7', dealId: 'DL-9102' }))).toBe('/platform-v7/documents?document=DOC-7');
    expect(supportLinkedExecutionHref(supportCase({ relatedEntityType: 'money', relatedEntityId: 'MONEY-1', dealId: 'DL-9102' }))).toBe('/platform-v7/bank?money=MONEY-1');
  });
});
