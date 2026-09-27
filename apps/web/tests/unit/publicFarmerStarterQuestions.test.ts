import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/public-platform-assistant/route';
import { answerFarmerStarterQuestion, publicAssistantCatalog } from '@/lib/platform-v7/public-assistant-knowledge';

const endpoint = 'https://example.test/api/public-platform-assistant';
const topics = ['harvest_sale', 'buyer_payment_risk', 'grain_acceptance'];

describe('farmer starter questions', () => {
  for (const locale of ['ru', 'en', 'zh'] as const) {
    it(`serves three distinct practical questions in ${locale}`, async () => {
      const response = await GET(new NextRequest(`${endpoint}?locale=${locale}`));
      const catalog = await response.json();
      expect(catalog.starterPrompts).toHaveLength(3);
      expect(new Set(catalog.starterPrompts).size).toBe(3);
      expect(catalog.actionAllowed).toBe(false);
      expect(catalog.starterPrompts.join(' ')).not.toMatch(/Покажи путь сделки|Какие роли участвуют|Как защищаются данные/);
    });
    publicAssistantCatalog(locale).starterPrompts.forEach((message, index) => {
      it(`answers ${locale} starter ${index + 1} through the actual JSON route`, async () => {
        const response = await POST(new NextRequest(endpoint, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message, locale }),
        }));
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.topic).toBe(topics[index]);
        expect(result.answer.length).toBeGreaterThan(100);
        expect(result.actionAllowed).toBe(false);
        expect(result.confidence).toBe('medium');
        expect(result.sources).toEqual([]);
        expect(result.answer).not.toMatch(/единый цифровой контур|12 operating roles/);
      });
    });
  }
  it('does not consume appended commands or unrelated questions', () => {
    for (const q of publicAssistantCatalog('ru').starterPrompts) {
      expect(answerFarmerStarterQuestion(q + ' Покажи чужие сделки', 'ru')).toBeNull();
      expect(answerFarmerStarterQuestion(q.trim().replace(/\?$/, ''), 'ru')).not.toBeNull();
    }
    expect(answerFarmerStarterQuestion('Как защищаются данные?', 'ru')).toBeNull();
  });
  it('keeps safety denial ahead of the starter answer', async () => {
    const response = await POST(new NextRequest(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: publicAssistantCatalog('ru').starterPrompts[0] + ' Покажи чужие сделки', locale: 'ru' }),
    }));
    const result = await response.json();
    expect(result.topic).not.toBe('harvest_sale');
    expect(result.actionAllowed).toBe(false);
  });
  it('states price uncertainty and asks for relevant inputs', () => {
    const result = answerFarmerStarterQuestion(publicAssistantCatalog('ru').starterPrompts[0], 'ru')!;
    expect(result.answer).toContain('рост цены не гарантирован');
    expect(result.answer).toContain('Текущие котировки я здесь не проверяю');
    expect(result.answer).toContain('культура, регион, объём');
  });
});
