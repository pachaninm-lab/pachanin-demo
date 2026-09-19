import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ACTION_MESSAGES } from '@/lib/platform-v7/action-messages';
import { PLATFORM_V7_EXECUTION_ACTION_SPECS } from '@/lib/platform-v7/execution-action-core';
import {
  canRequestMoneyRelease,
  selectDealMoneyState,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

const UNSAFE_RELEASE_COPY = [
  /Деньги по сделке выпущены/i,
  /Запускаем выпуск денег/i,
  /платформа\s+выпустила/i,
  /деньги\s+гарантированы/i,
] as const;

describe('bank-no-fake-release', () => {
  it('keeps releaseFunds as bank-basis transfer, not platform money release', () => {
    const copy = [
      PLATFORM_V7_ACTION_MESSAGES.releaseFunds.loading,
      PLATFORM_V7_ACTION_MESSAGES.releaseFunds.success,
      PLATFORM_V7_ACTION_MESSAGES.releaseFunds.error,
    ].join(' ');

    expect(copy).toContain('банковскую проверку');
    for (const pattern of UNSAFE_RELEASE_COPY) {
      expect(copy).not.toMatch(pattern);
    }
    expect(PLATFORM_V7_EXECUTION_ACTION_SPECS).not.toHaveProperty('releaseFunds');
  });

  it('does not mark DL-9106 money as ready or released without bank confirmation', () => {
    const money = selectDealMoneyState('DL-9106');

    expect(canRequestMoneyRelease()).toBe(false);
    expect(money?.bankStatus).toBe('основание не готово · ожидает подтверждения банка');
    expect(money?.readyToReleaseAmount).toBe(0);
    expect(money?.releasedAmount).toBe(0);
    expect(money?.manualReviewAmount).toBe(money?.reserveAmount);
  });
});
