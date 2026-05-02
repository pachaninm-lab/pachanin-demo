import { describe, expect, it } from 'vitest';
import { resolvePlatformV7ManualAction } from '@/lib/platform-v7/manual-actions';

describe('platform-v7 manual actions', () => {
  it('blocks manual actions without a reason', () => {
    const result = resolvePlatformV7ManualAction({
      actionId: 'manual-doc-request',
      kind: 'request_document',
      entityId: 'DL-9102',
      actor: 'Оператор',
      reason: '   ',
    });

    expect(result.allowed).toBe(false);
    expect(result.journal).toBeNull();
    expect(result.message).toContain('нужна причина');
    expect(result.nextStep).toContain('Укажите причину');
  });

  it('creates a journal entry when a reason is provided', () => {
    const result = resolvePlatformV7ManualAction({
      actionId: 'manual-review',
      kind: 'send_to_review',
      entityId: 'DL-9108',
      actor: 'Банк',
      reason: 'Не хватает транспортного пакета',
      timestamp: '2026-05-02T10:00:00.000Z',
    });

    expect(result.allowed).toBe(true);
    expect(result.message).toBe('Ручное действие зафиксировано.');
    expect(result.nextStep).toContain('ручную проверку');
    expect(result.journal).toEqual({
      type: 'PLATFORM_V7_MANUAL_ACTION',
      actionId: 'manual-review',
      kind: 'send_to_review',
      entityId: 'DL-9108',
      actor: 'Банк',
      reason: 'Не хватает транспортного пакета',
      timestamp: '2026-05-02T10:00:00.000Z',
    });
  });

  it('uses custom next step when provided', () => {
    const result = resolvePlatformV7ManualAction({
      actionId: 'close-dispute',
      kind: 'close_dispute',
      entityId: 'DSP-2406',
      actor: 'Арбитр',
      reason: 'Стороны приняли решение',
      nextStep: 'Передать решение банку для проверки удержания.',
      timestamp: '2026-05-02T10:00:00.000Z',
    });

    expect(result.allowed).toBe(true);
    expect(result.nextStep).toBe('Передать решение банку для проверки удержания.');
    expect(result.journal?.reason).toBe('Стороны приняли решение');
  });
});
