import { describe, expect, it } from 'vitest';
import {
  isSdizLifecycleBlockingMoneyRelease,
  selectDealExecutionCase,
  selectDealSdizLifecycle,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

describe('sdiz-lifecycle', () => {
  it('splits SDIZ into legal lifecycle steps instead of one generic status', () => {
    const steps = selectDealSdizLifecycle('DL-9106');

    expect(steps.map((step) => step.id)).toEqual([
      'fgis_party_created',
      'sdiz_issued',
      'sdiz_signed',
      'sdiz_transferred',
      'sdiz_redeemed',
      'sdiz_refusal_or_manual_check',
    ]);
  });

  it('keeps buyer redemption as a separate blocking step', () => {
    const steps = selectDealSdizLifecycle('DL-9106');
    const redemption = steps.find((step) => step.id === 'sdiz_redeemed');

    expect(redemption).toMatchObject({
      responsibleRole: 'buyer',
      blocksMoneyRelease: true,
      nextAction: 'погасить СДИЗ после приёмки',
    });
  });

  it('blocks money release while FGIS and redemption are only manual or incomplete', () => {
    const executionCase = selectDealExecutionCase('DL-9106');
    const steps = selectDealSdizLifecycle('DL-9106');

    expect(executionCase?.fgis.partyStatus).toContain('ручная проверка');
    expect(steps.some((step) => step.status.includes('ручная проверка'))).toBe(true);
    expect(steps.filter((step) => step.blocksMoneyRelease).length).toBeGreaterThan(0);
    expect(isSdizLifecycleBlockingMoneyRelease('DL-9106')).toBe(true);
  });
});
