import { describe, expect, it } from 'vitest';
import {
  isExplicitAgroFollowUp,
  selectTurnSafeAgroHistory,
} from '@/lib/platform-v7/agro-chat-turn-context';

const platformHistory = [
  { role: 'user' as const, text: 'Как защищаются данные?' },
  { role: 'assistant' as const, text: 'Доступ назначается сервером по роли и организации.' },
];

const machineryHistory = [
  { role: 'user' as const, text: 'Какая техника нужна, чтобы убрать урожай пшеницы?' },
  { role: 'assistant' as const, text: 'Нужны комбайн, транспорт и согласованная послеуборочная логистика.' },
];

describe('TAI public agricultural chat current-turn binding', () => {
  it.each([
    'Как стать фермером?',
    'Как растёт кукуруза?',
    'Какая техника нужна, чтобы убрать урожай пшеницы?',
    'Как рассчитать себестоимость молока?',
    'Как кормить молочное стадо?',
  ])('starts a complete new question without prior history: %s', (question) => {
    expect(isExplicitAgroFollowUp(question)).toBe(false);
    expect(selectTurnSafeAgroHistory(question, platformHistory)).toEqual([]);
  });

  it.each([
    'А какая модель комбайна лучше?',
    'Почему именно?',
    'Расскажи подробнее',
    'А для кукурузы?',
    'Что делать дальше?',
  ])('retains bounded context only for an explicit follow-up: %s', (question) => {
    expect(isExplicitAgroFollowUp(question)).toBe(true);
    expect(selectTurnSafeAgroHistory(question, machineryHistory)).toEqual(machineryHistory);
  });

  it('blocks the exact observed one-turn answer shift', () => {
    expect(selectTurnSafeAgroHistory('Как стать фермером?', platformHistory)).toEqual([]);
    expect(selectTurnSafeAgroHistory('Как растёт кукуруза?', machineryHistory)).toEqual([]);
  });

  it('does not mistake agronomic words beginning with conjunction letters for follow-ups', () => {
    expect(isExplicitAgroFollowUp('Агроном оценивает состояние поля')).toBe(false);
    expect(isExplicitAgroFollowUp('Ирригация для кукурузы')).toBe(false);
  });
});