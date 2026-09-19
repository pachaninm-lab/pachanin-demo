import { describe, expect, it } from 'vitest';
import {
  actionFeedbackToLogEvent,
  createPlatformV7ActionFeedback,
  createPlatformV7ActionResult,
  isPlatformV7ActionTerminal,
  platformV7ActionToastMessage,
} from '@/lib/platform-v7/action-feedback';

describe('platform-v7 action feedback', () => {
  it('creates success feedback with a stable message contract', () => {
    const feedback = createPlatformV7ActionFeedback({
      actionId: 'releaseFunds',
      entityId: 'DL-9102',
      status: 'success',
      message: 'Деньги по сделке выпущены.',
      timestamp: '2026-04-25T07:50:00.000Z',
    });

    expect(feedback).toEqual({
      actionId: 'releaseFunds',
      entityId: 'DL-9102',
      status: 'success',
      message: 'Деньги по сделке выпущены.',
      severity: 'success',
      retryable: false,
      timestamp: '2026-04-25T07:50:00.000Z',
    });
  });

  it('marks failed actions as retryable by default', () => {
    const feedback = createPlatformV7ActionFeedback({
      actionId: 'manualReview',
      entityId: 'DL-9118',
      status: 'error',
      message: 'Действие не выполнено.',
    });

    expect(feedback.severity).toBe('error');
    expect(feedback.retryable).toBe(true);
  });

  it('converts feedback to action log event', () => {
    const feedback = createPlatformV7ActionFeedback({
      actionId: 'closeDispute',
      entityId: 'DK-2024-89',
      status: 'success',
      message: 'Спор закрыт.',
      timestamp: '2026-04-25T07:50:00.000Z',
    });

    expect(actionFeedbackToLogEvent(feedback, 'Оператор')).toMatchObject({
      id: 'closeDispute:DK-2024-89:2026-04-25T07:50:00.000Z',
      actor: 'Оператор',
      severity: 'success',
    });
  });

  it('creates action result with next step and journal entry', () => {
    const result = createPlatformV7ActionResult({
      actionId: 'checkDocs',
      entityId: 'DL-9102',
      actor: 'Оператор',
      label: 'Проверить документы',
      testMode: true,
      nextStep: 'Открыть проверку выпуска денег.',
      timestamp: '2026-04-25T07:50:00.000Z',
    });

    expect(result.feedback.status).toBe('success');
    expect(result.feedback.message).toContain('тестовый результат');
    expect(result.nextStep).toBe('Открыть проверку выпуска денег.');
    expect(result.testMode).toBe(true);
    expect(result.journal).toMatchObject({
      actionId: 'checkDocs',
      entityId: 'DL-9102',
      actor: 'Оператор',
      severity: 'success',
    });
  });

  it('creates stopped action result with reason and retryable feedback', () => {
    const result = createPlatformV7ActionResult({
      actionId: 'releaseCheck',
      entityId: 'DL-9108',
      actor: 'Банк',
      label: 'Проверить выпуск денег',
      stopReason: 'Не хватает документов',
      timestamp: '2026-04-25T07:50:00.000Z',
    });

    expect(result.feedback.status).toBe('error');
    expect(result.feedback.severity).toBe('warning');
    expect(result.feedback.retryable).toBe(true);
    expect(result.feedback.message).toContain('Не хватает документов');
    expect(result.nextStep).toContain('ручную проверку');
  });

  it('builds toast messages and terminal status flags', () => {
    expect(platformV7ActionToastMessage({ entityId: 'DL-9102', message: 'Готово.' })).toBe('DL-9102: Готово.');
    expect(isPlatformV7ActionTerminal('loading')).toBe(false);
    expect(isPlatformV7ActionTerminal('success')).toBe(true);
    expect(isPlatformV7ActionTerminal('error')).toBe(true);
  });
});
