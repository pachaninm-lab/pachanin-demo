import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGektaProductCopy } from '@/lib/gekta/product-copy';
import { getGektaFaqSchema } from '@/lib/gekta/seo';
import { getGektaCopy } from '@/lib/gekta/content';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const capabilities = read('components/gekta/GektaCapabilities.tsx');
const discovery = read('components/gekta/GektaDiscoverySections.tsx');
const emptyState = read('components/gekta/GektaEmptyState.tsx');
const cta = read('components/gekta/GektaProductCta.tsx');
const hero = read('components/gekta/GektaHero.tsx');
const frame = read('components/gekta/GektaExperienceFrame.tsx');
const workspace = read('components/gekta/GektaChatWorkspace.tsx');
const shell = read('components/gekta/GektaProductShell.tsx');

const LOCALES = ['ru', 'en', 'zh'] as const;

describe('Gekta product page experience', () => {
  it('server-renders the capability block, including the detail text behind the disclosure', () => {
    expect(capabilities).not.toContain("'use client'");
    expect(capabilities).toContain('{product.capabilityLead}');
    expect(capabilities).toContain('{group.summary}');
    expect(capabilities).toContain('{group.problem}');
    expect(capabilities).toContain('{group.items.map(');
    expect(discovery).toContain('<GektaCapabilities locale={locale} />');
  });

  it('covers every required capability direction in all three locales', () => {
    for (const locale of LOCALES) {
      const copy = getGektaProductCopy(locale);
      expect(copy.capabilityGroups.length).toBeGreaterThanOrEqual(7);
      for (const group of copy.capabilityGroups) {
        expect(group.summary.length).toBeGreaterThan(0);
        expect(group.problem.length).toBeGreaterThan(0);
        expect(group.items.length).toBeGreaterThanOrEqual(4);
      }
    }
    const ru = getGektaProductCopy('ru').capabilityGroups.map((group) => `${group.title} ${group.summary} ${group.items.join(' ')}`).join(' ');
    for (const topic of ['растениевод', 'почв', 'защит', 'вредител', 'сорняк', 'урожайност', 'животноводств', 'кормлен', 'техник', 'хранени', 'качеств', 'логистик', 'себестоимост', 'маржу', 'сценари', 'документ', 'таблиц', 'расчёт', 'расхожден', 'многошагов', 'контекст', 'вложени', 'источник']) {
      expect(ru.toLowerCase()).toContain(topic);
    }
  });

  it('frames the starter buttons as examples and offers substantially more on demand', () => {
    expect(emptyState).toContain('{copy.examplesTitle}');
    expect(emptyState).toContain('{copy.examplesLead}');
    expect(emptyState).toContain("data-gekta-more-examples='true'");
    expect(emptyState).toContain('aria-expanded={expanded}');
    expect(emptyState).toContain("aria-controls='gekta-more-examples'");
    for (const locale of LOCALES) {
      const copy = getGektaProductCopy(locale);
      expect(copy.extraStarters.length).toBeGreaterThanOrEqual(19);
      expect(copy.examplesTitle.length).toBeGreaterThan(0);
    }
    expect(getGektaProductCopy('ru').examplesTitle).toBe('Примеры запросов');
    expect(getGektaProductCopy('ru').examplesLead).toBe('Выберите пример, чтобы начать разговор, или задайте Гекте свой вопрос.');
    expect(getGektaProductCopy('ru').examplesMore).toBe('Показать больше примеров');
  });

  it('fills the composer from an example instead of sending it silently', () => {
    expect(workspace).toContain('const useStarter = React.useCallback((prompt: string) => {');
    expect(workspace).toContain('setInput(cleanText(prompt).slice(0, 1_200));');
    expect(workspace).toContain('onStarter={useStarter}');
    expect(emptyState).not.toContain('submit(');
  });

  it('separates a primary Gekta action from a quieter platform exit', () => {
    expect(cta).toContain("data-gekta-primary-cta='true'");
    expect(cta).toContain("data-gekta-secondary-cta='true'");
    expect(cta).toContain('bg-emerald-800');
    expect(cta).toContain('{copy.ctaPrimary}');
    expect(cta).toContain('{copy.ctaSecondary}');
    expect(hero).toContain("<GektaProductCta locale={locale} variant='hero' />");
    expect(discovery).toContain('<GektaProductCta locale={locale} />');
    expect(getGektaProductCopy('ru').ctaPrimary).toBe('Продолжить разговор с Гектой');
    expect(getGektaProductCopy('ru').ctaSecondary).toBe('Перейти в «Прозрачную Цену»');
  });

  it('reworks the audience block into role cards that state the value for the role', () => {
    expect(discovery).toContain('{product.audienceCards.map(');
    expect(discovery).toContain('{card.role}');
    expect(discovery).toContain('{card.value}');
    for (const locale of LOCALES) {
      const cards = getGektaProductCopy(locale).audienceCards;
      expect(cards.length).toBe(6);
      // Chinese carries the same meaning in far fewer characters.
      const minimum = locale === 'zh' ? 8 : 20;
      for (const card of cards) expect(card.value.length).toBeGreaterThan(minimum);
    }
    expect(getGektaCopy('ru').audienceTitle).toBe('Для тех, кто принимает решения в сельском хозяйстве');
  });

  it('keeps one floating product entry that yields to the open workspace', () => {
    expect(frame).toContain("data-gekta-floating-entry='product'");
    expect(frame).toContain('{!enteredChat ? (');
    expect(frame).toContain('aria-label={FLOATING_LABEL[locale]}');
    expect(frame).toContain('env(safe-area-inset-bottom');
  });

  it('returns to the product home from the chat header without losing history', () => {
    expect(workspace).toContain("data-gekta-brand-home='true'");
    expect(workspace).toContain('href={GEKTA_PATHS[locale]}');
    expect(workspace).toContain("data-gekta-header-new-chat='true'");
    expect(workspace).toContain('onClick={newChat}');
  });

  it('publishes FAQ structured data only for questions the reader can see', () => {
    expect(shell).toContain('getGektaFaqSchema(locale)');
    for (const locale of LOCALES) {
      const schema = getGektaFaqSchema(locale);
      const visible = getGektaCopy(locale).faq;
      expect(schema['@type']).toBe('FAQPage');
      expect(schema.mainEntity.length).toBe(visible.length);
      expect(schema.mainEntity[0].name).toBe(visible[0][0]);
      expect(JSON.stringify(schema)).not.toContain('AggregateRating');
      expect(JSON.stringify(schema)).not.toContain('"Offer"');
    }
  });
});
