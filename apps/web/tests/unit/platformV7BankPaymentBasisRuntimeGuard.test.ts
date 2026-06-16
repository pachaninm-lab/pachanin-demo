import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPlatformV7BankPaymentBasisRuntimeAction } from '@/lib/platform-v7/bank-payment-basis-runtime-action';

const source = fs.readFileSync(path.join(process.cwd(), 'apps/web/lib/platform-v7/bank-payment-basis-runtime-action.ts'), 'utf8');

describe('platform-v7 bank payment basis runtime guard', () => {
  it('blocks DL-9106 basis handoff while the full bank-check matrix is not closed', () => {
    const result = buildPlatformV7BankPaymentBasisRuntimeAction({ actorRole: 'operator', dealId: 'DL-9106' });

    expect(result.status).toBe('blocked');
    expect(result.uiStatusLabel).toBe('основание не передано');
    expect(result.uiSafetyNote).toContain('Основание для банковской проверки заблокировано');
    expect(result.uiSafetyNote).toContain('ФГИС/СДИЗ');
    expect(result.uiSafetyNote).toContain('качество');
  });

  it('blocks empty and unknown deal ids', () => {
    expect(buildPlatformV7BankPaymentBasisRuntimeAction({ actorRole: 'operator', dealId: '' }).status).toBe('blocked');
    expect(buildPlatformV7BankPaymentBasisRuntimeAction({ actorRole: 'operator', dealId: 'UNKNOWN-DEAL' }).status).toBe('blocked');
  });

  it('keeps runtime handoff tied to evaluateReleaseGuard before creating action events', () => {
    const guardIndex = source.indexOf('evaluateReleaseGuard(deal)');
    const eventIndex = source.indexOf('buildPlatformV7RuntimeActionEvent');

    expect(source).toContain('canonicalDomainDeals.find');
    expect(source).toContain('check.canRequestRelease');
    expect(source).toContain('check.canExecuteRelease');
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(eventIndex).toBeGreaterThanOrEqual(0);
    expect(guardIndex).toBeLessThan(eventIndex);
  });

  it('does not frame payment-basis handoff as money movement', () => {
    expect(source).toContain('Это не выпуск денег');
    expect(source).toContain('не подтверждение выплаты');
    expect(source).toContain('не замена внешнего банковского события');
  });
});
