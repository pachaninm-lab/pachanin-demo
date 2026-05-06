import { describe, expect, it } from 'vitest';
import {
  doesPlatformV7SupportCaseNeedMoneyEscalation,
  isPlatformV7SupportCaseLinked,
  isPlatformV7SupportCaseOperatorOwned,
  isPlatformV7SupportCaseOverdue,
  type PlatformV7SupportCase,
} from '@/lib/platform-v7/support-model';

const supportCase: PlatformV7SupportCase = {
  id: 'support-1',
  title: 'Документ блокирует рейс',
  description: 'Не закрыт транспортный документ',
  status: 'in_progress',
  priority: 'P1',
  category: 'documents',
  requesterRole: 'logistics',
  relatedEntityType: 'trip',
  relatedEntityId: 'trip-1',
  dealId: 'deal-1',
  tripId: 'trip-1',
  ownerId: 'operator-1',
  slaDueAt: '2026-05-06T12:00:00.000Z',
  createdAt: '2026-05-06T10:00:00.000Z',
  updatedAt: '2026-05-06T10:00:00.000Z',
};

describe('platform-v7 support model', () => {
  it('requires support cases to be linked to a deal object or execution object', () => {
    expect(isPlatformV7SupportCaseLinked(supportCase)).toBe(true);
    expect(isPlatformV7SupportCaseLinked({ ...supportCase, relatedEntityId: '' })).toBe(false);
  });

  it('marks unresolved overdue cases but not resolved or closed cases', () => {
    expect(isPlatformV7SupportCaseOverdue(supportCase, '2026-05-06T13:00:00.000Z')).toBe(true);
    expect(isPlatformV7SupportCaseOverdue({ ...supportCase, status: 'resolved' }, '2026-05-06T13:00:00.000Z')).toBe(false);
    expect(isPlatformV7SupportCaseOverdue({ ...supportCase, status: 'closed' }, '2026-05-06T13:00:00.000Z')).toBe(false);
  });

  it('keeps operator ownership explicit', () => {
    expect(isPlatformV7SupportCaseOperatorOwned(supportCase)).toBe(true);
    expect(isPlatformV7SupportCaseOperatorOwned({ ...supportCase, ownerId: undefined })).toBe(false);
  });

  it('escalates P0 and money-risk cases', () => {
    expect(doesPlatformV7SupportCaseNeedMoneyEscalation({ ...supportCase, priority: 'P0' })).toBe(true);
    expect(doesPlatformV7SupportCaseNeedMoneyEscalation({ ...supportCase, category: 'money', moneyAtRiskRub: 10_000 })).toBe(true);
    expect(doesPlatformV7SupportCaseNeedMoneyEscalation(supportCase)).toBe(false);
  });
});
