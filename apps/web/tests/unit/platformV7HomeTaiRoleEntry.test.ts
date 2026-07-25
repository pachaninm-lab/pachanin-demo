import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 homepage TAI and role-entry quality contract', () => {
  const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const enhancements = read('components/platform-v7/PlatformV7HomeEnhancements.tsx');
  const enhancementCss = read('components/platform-v7/PlatformV7HomeEnhancements.module.css');
  const copy = read('i18n/platform-v7-home-enhancements.ts');
  const head = read('app/platform-v7/head.tsx');

  it('exposes four public task-based perspectives without client-authoritative role selection', () => {
    expect(home).toContain("href='#role-entry'");
    expect(home).toContain('<PublicRoleEntrances locale={locale} />');
    expect(enhancements).toContain("id='role-entry'");
    expect(enhancements).toContain('entry=role');
    expect(copy).toContain("key: 'seller'");
    expect(copy).toContain("key: 'buyer'");
    expect(copy).toContain("key: 'operator'");
    expect(copy).toContain("key: 'finance'");
    expect(copy).toContain("perspective: 'seller'");
    expect(copy).toContain("perspective: 'buyer'");
    expect(copy).toContain("perspective: 'operator'");
    expect(copy).toContain("perspective: 'bank'");
    expect(copy).toContain('Выбор ракурса не меняет роль, права или доступ к данным');
    expect(enhancements).not.toContain('accessToken');
    expect(enhancements).not.toContain('tenantId');
    expect(enhancements).not.toContain('membership');
  });

  it('places the concrete Deal deviation before category and lifecycle explanation', () => {
    const scenarioIndex = home.indexOf("id='participants'");
    const categoryIndex = home.indexOf("className='pc-v6-category'");
    const lifecycleIndex = home.indexOf("id='deal-path'");
    expect(scenarioIndex).toBeGreaterThan(-1);
    expect(categoryIndex).toBeGreaterThan(scenarioIndex);
    expect(lifecycleIndex).toBeGreaterThan(categoryIndex);
  });

  it('keeps one dominant hero conversion and makes the Deal walkthrough dominant again at the close', () => {
    const firstHero = home.slice(home.indexOf("className='pc-v6-hero'"), home.indexOf("className='pc-v6-trust-strip'"));
    expect(firstHero.match(/className='pc-v6-primary'/g)?.length).toBe(1);
    expect(firstHero).toContain("eventName='hero_primary_cta'");
    expect(firstHero).toContain("eventName='hero_secondary_cta'");
    expect(firstHero).toContain('<HeroTaiEntry locale={locale} taiHref={taiHref} />');
    expect(enhancements).toContain("eventName='hero_tai_explainer_open'");

    const finalSection = home.slice(home.indexOf("className='pc-v6-final'"));
    const dealPrimary = finalSection.indexOf("href={dealHref} className='pc-v6-primary'");
    const connectSecondary = finalSection.indexOf("href='#connect-organization' className='pc-v6-secondary'");
    expect(dealPrimary).toBeGreaterThan(-1);
    expect(connectSecondary).toBeGreaterThan(dealPrimary);
  });

  it('explains TAI by name, purpose, reasoning path, monetary impact and human boundary in RU EN ZH', () => {
    expect(home).toContain("href='#tai'");
    expect(copy.match(/TAI — Transparent Agro Intelligence/g)?.length).toBe(3);
    expect(copy).toContain('Для чего нужен TAI');
    expect(copy).toContain('Влияние на Сделку');
    expect(copy).toContain('Как TAI формирует ответ');
    expect(copy).toContain('Понимает контекст');
    expect(copy).toContain('Находит отклонение');
    expect(copy).toContain('Показывает основание');
    expect(copy).toContain('Готовит действие');
    expect(copy).toContain('для подтверждения человеком');
    expect(copy).toContain('What TAI is for');
    expect(copy).toContain('TAI 的用途');
    expect(home).toContain('<TaiDefinition locale={locale} />');
    expect(home).toContain('<TaiImpact locale={locale} />');
    expect(home).toContain('<TaiWorkflow locale={locale} />');
  });

  it('keeps contact dock labels at full contrast while visibility and transform handle hiding', () => {
    expect(enhancements).toContain('CONTACT_DOCK_CONTRAST_BOUNDARY');
    expect(enhancements).toContain('opacity: 1 !important');
    expect(enhancements).toContain('transition: transform .2s ease !important');
    expect(enhancements).toContain(".pc-public-contact-dock-action:disabled");
    expect(enhancements).toContain('-webkit-text-fill-color: currentColor');
    expect(enhancements).not.toContain('transition: transform .2s ease, opacity');
  });

  it('does not introduce unverified business proof or the rejected partner-positioning sentence', () => {
    const combined = `${home}\n${enhancements}\n${copy}\n${head}`.toLowerCase();
    const forbidden = [
      'специализированные партнёры',
      'исполняют логистику, приёмку, лабораторию и расчёты',
      '35 регионов',
      '12 млн тонн',
      '20 000 перевозчиков',
      'банк подключён',
      'фгис подключён',
      'эдо подключён',
      'боевой контур',
    ];
    for (const phrase of forbidden) expect(combined).not.toContain(phrase);
  });

  it('keeps SEO, Open Graph and structured data aligned with the full agricultural Deal and TAI', () => {
    expect(head).toContain("pageTitle = 'Прозрачная Цена — контроль исполнения агросделки от цены до расчёта'");
    expect(head).toContain('TAI объясняет блокеры, риски и следующий шаг');
    expect(head).toContain('цифровая инфраструктура агросделки');
    expect(head).toContain('TAI Transparent Agro Intelligence');
    expect(head).toContain("name: 'Единый контур исполнения агросделки'");
    expect(head).toContain('производители и продавцы сельскохозяйственной продукции');
    expect(head).toContain('hrefLang="x-default"');
    expect(head).toContain('property="og:type"');
    expect(head).toContain('name="twitter:card"');
    expect(head).not.toContain('контур исполнения зерновой сделки');
    expect(head).not.toContain('исполнения зерновых сделок');
  });

  it('keeps mobile-first navigation, minimum targets, accessibility focus and reduced motion', () => {
    expect(enhancementCss).toContain('scroll-snap-type: x mandatory');
    expect(enhancementCss).toMatch(/min-height:\s*44px/);
    expect(enhancementCss).toContain(':focus-visible');
    expect(enhancementCss).toContain('@media (max-width: 767px)');
    expect(enhancementCss).toContain('@media (min-width: 768px)');
    expect(enhancementCss).toContain('@media (min-width: 1100px)');
    expect(enhancementCss).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
    expect(enhancementCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(enhancementCss).toContain('@media (forced-colors: active)');
  });
});
