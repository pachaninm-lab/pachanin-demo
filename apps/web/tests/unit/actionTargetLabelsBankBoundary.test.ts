import { describe, expect, it } from 'vitest';
import {
  platformV7ActionTargetById,
  platformV7ActionTargets,
} from '@/lib/platform-v7/action-targets';

const FORBIDDEN_LABELS = [
  /Выпустить деньги/i,
  /Запросить выпуск денег/i,
  /Запросить выпуск$/i,
  /Повторить webhook/i,
  /webhook/i,
  /live bank/i,
  /live callback/i,
  /платформа выпускает деньги/i,
  /деньги автоматически выпускаются/i,
];

describe('platform-v7 action target labels bank boundary', () => {
  it('does not expose platform-money-release or webhook labels', () => {
    const labels = platformV7ActionTargets().map((target) => target.label).join('\n');

    for (const pattern of FORBIDDEN_LABELS) {
      expect(labels).not.toMatch(pattern);
    }
  });

  it('describes release actions as bank review and basis transfer', () => {
    expect(platformV7ActionTargetById('deal-request-release')?.label).toBe('Запросить банковскую проверку');
    expect(platformV7ActionTargetById('ct-request-release')?.label).toBe('Запросить банковскую проверку');
    expect(platformV7ActionTargetById('bank-request-release')?.label).toBe('Запросить банковскую проверку');
    expect(platformV7ActionTargetById('deal-release-funds')?.label).toBe('Передать основание банку');
    expect(platformV7ActionTargetById('bank-release-funds')?.label).toBe('Передать основание банку');
  });

  it('describes bank retry as a bank confirmation request', () => {
    expect(platformV7ActionTargetById('bank-webhook-retry')?.label).toBe('Повторить запрос банка');
  });
});
