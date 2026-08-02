import { describe, expect, it } from 'vitest';
import {
  isVerifiedPlatformQuestion,
  selectAgroChatHistory,
  shouldCarryAgroChatHistory,
} from '@/lib/platform-v7/agro-chat-context';

const priorPlatformHistory = [
  { role: 'user' as const, text: 'Как защищаются данные?' },
  { role: 'assistant' as const, text: 'Доступ назначает сервер по роли и организации.' },
];

const priorMachineryHistory = [
  { role: 'user' as const, text: 'Какая техника нужна, чтобы убрать урожай пшеницы?' },
  { role: 'assistant' as const, text: 'Нужны зерноуборочный комбайн и транспорт.' },
];

describe('public agricultural chat current-turn binding', () => {
  it.each([
    'Как стать фермером?',
    'Как растёт кукуруза?',
    'Какая техника нужна, чтобы убрать урожай пшеницы?',
    'Как рассчитать себестоимость молока?',
  ])('treats a complete new agricultural question as a new topic: %s', (question) => {
    expect(shouldCarryAgroChatHistory(question)).toBe(false);
    expect(selectAgroChatHistory(question, priorPlatformHistory)).toEqual([]);
  });

  it.each([
    'А какая модель комбайна лучше?',
    'Почему именно?',
    'Расскажи подробнее',
    'А для кукурузы?',
    'Что делать дальше?',
  ])('keeps context only for an explicit follow-up: %s', (question) => {
    expect(shouldCarryAgroChatHistory(question)).toBe(true);
    expect(selectAgroChatHistory(question, priorMachineryHistory)).toEqual(priorMachineryHistory);
  });

  it('prevents the exact observed one-turn answer shift', () => {
    expect(selectAgroChatHistory('Как стать фермером?', priorPlatformHistory)).toEqual([]);
    expect(selectAgroChatHistory('Как растёт кукуруза?', priorMachineryHistory)).toEqual([]);
  });

  it.each([
    'Что такое «Прозрачная Цена»?',
    'Как защищаются данные?',
    'Как зарегистрироваться в личном кабинете?',
    'Какие роли участвуют в Сделке?',
    'Подключена ли ФГИС «Зерно»?',
  ])('keeps verified platform questions on the governed platform route: %s', (question) => {
    expect(isVerifiedPlatformQuestion(question)).toBe(true);
  });

  it.each([
    'Как растёт кукуруза?',
    'Как стать фермером?',
    'Какая техника нужна для уборки пшеницы?',
    'Как кормить молочное стадо?',
    'Как работает система орошения?',
  ])('sends general agricultural questions to the agricultural model: %s', (question) => {
    expect(isVerifiedPlatformQuestion(question)).toBe(false);
  });
});
