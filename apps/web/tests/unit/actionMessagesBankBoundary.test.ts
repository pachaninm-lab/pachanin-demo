import { describe, expect, it } from 'vitest';
import {
  platformV7ActionMessageIds,
  platformV7ActionMessages,
} from '@/lib/platform-v7/action-messages';

const FORBIDDEN = [
  /Деньги по сделке выпущены/i,
  /Запускаем выпуск денег/i,
  /Не удалось выпустить деньги/i,
  /Запрос на выпуск денег создан/i,
  /Создаём запрос на выпуск денег/i,
  /webhook/i,
  /live bank/i,
  /live callback/i,
  /платформа выпускает деньги/i,
  /платформа сама выпускает деньги/i,
  /деньги автоматически выпускаются/i,
];

function allActionMessageText() {
  return platformV7ActionMessageIds()
    .flatMap((id) => {
      const message = platformV7ActionMessages(id);
      return [message.loading, message.success, message.error];
    })
    .join('\n');
}

describe('platform-v7 action message bank boundary', () => {
  it('does not expose platform-money-movement or webhook claims', () => {
    const text = allActionMessageText();

    for (const pattern of FORBIDDEN) {
      expect(text).not.toMatch(pattern);
    }
  });

  it('describes money actions as bank review and confirmation requests', () => {
    expect(platformV7ActionMessages('requestRelease')).toEqual({
      loading: 'Готовим запрос на банковскую проверку выплаты.',
      success: 'Запрос на банковскую проверку выплаты создан.',
      error: 'Не удалось подготовить запрос на банковскую проверку выплаты.',
    });

    expect(platformV7ActionMessages('releaseFunds')).toEqual({
      loading: 'Передаём основание на банковскую проверку.',
      success: 'Основание передано на банковскую проверку.',
      error: 'Не удалось передать основание на банковскую проверку.',
    });

    expect(platformV7ActionMessages('retryWebhook')).toEqual({
      loading: 'Повторяем запрос подтверждения банка.',
      success: 'Запрос подтверждения банка повторно зафиксирован.',
      error: 'Не удалось повторить запрос подтверждения банка.',
    });
  });
});
