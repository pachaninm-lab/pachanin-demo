import { describe, expect, it } from 'vitest';
import { answerProspectQuestion, prospectTopics } from '@/lib/platform-v7/prospect-assistant-knowledge';

const CASES = [
  ['Кому подходит платформа?', 'audience'],
  ['Какая выгода и окупаемость?', 'value'],
  ['Сколько стоит внедрение?', 'pricing'],
  ['Как подключить организацию?', 'onboarding'],
  ['Сколько длится запуск и обучение?', 'implementation'],
  ['Что получит покупатель?', 'buyer_value'],
  ['Что даст система продавцу?', 'seller_value'],
  ['Зачем это банку?', 'bank_value'],
  ['Как работает доставка и водитель?', 'logistics_value'],
  ['Что делать при расхождении веса и качества?', 'quality'],
  ['Можно получить кредит под сделку?', 'finance'],
  ['Как быть с НДС и бухгалтерией?', 'tax_accounting'],
  ['Есть ли юридическая сила у документов?', 'legal'],
  ['Как защищены данные и роли?', 'security'],
  ['Можно интегрировать 1С ERP и ЭДО?', 'integrations'],
  ['Какие KPI и отчёты будут?', 'analytics'],
  ['Что произойдёт при отказе сервера?', 'reliability'],
  ['Чем отличается от маркетплейса или биржи?', 'comparison'],
  ['Куда обращаться если не работает?', 'support'],
] as const;

describe('public prospect assistant knowledge', () => {
  it.each(CASES)('routes %s to %s', (question, expected) => {
    expect(answerProspectQuestion(question, 'ru')?.topic).toBe(expected);
  });

  it('covers the same topic catalog in all locales', () => {
    expect(prospectTopics('ru')).toHaveLength(19);
    expect(prospectTopics('en')).toHaveLength(19);
    expect(prospectTopics('zh')).toHaveLength(19);
  });

  it('does not invent an answer outside the verified map', () => {
    expect(answerProspectQuestion('кто победил вчера в футбольном матче', 'ru')).toBeNull();
  });

  it('keeps commercial and legal boundaries explicit', () => {
    const price = answerProspectQuestion('точная цена и тариф', 'ru');
    const legal = answerProspectQuestion('дайте юридическое заключение', 'ru');
    expect(price?.answer).toContain('не должна называться подтверждённой');
    expect(legal?.maturity).toContain('зависит от договора');
    expect(price?.actionAllowed).toBe(false);
    expect(legal?.actionAllowed).toBe(false);
  });
});
