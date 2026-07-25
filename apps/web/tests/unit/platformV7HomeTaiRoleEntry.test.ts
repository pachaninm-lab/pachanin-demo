import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 homepage TAI and role-entry quality contract', () => {
  const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const enhancements = read('components/platform-v7/PlatformV7HomeEnhancements.tsx');
  const enhancementCss = read('components/platform-v7/PlatformV7HomeEnhancements.module.css');
  const mobileDensityCss = read('components/platform-v7/PlatformV7HomeMobileDensity.css');
  const finalCss = read('components/platform-v7/PlatformV7HomeFinalPolish.css');
  const page = read('app/platform-v7/page.tsx');
  const copy = read('i18n/platform-v7-home-enhancements.ts');
  const heroCopy = read('i18n/platform-v7-hero-message.ts');
  const head = read('app/platform-v7/head.tsx');
  const contactDock = read('components/platform-v7/PublicContactDock.tsx');
  const hydrationSupport = read('components/platform-v7/HydrationSafeChatSupport.tsx');
  const legacyPolish = read('components/platform-v7/LegacyPublicMobileExperiencePolish.tsx');

  it('exposes task-based perspectives without client-authoritative role selection', () => {
    expect(home).toContain("href='#role-entry'");
    expect(home).toContain('<PublicRoleEntrances locale={locale} />');
    expect(enhancements).toContain("id='role-entry'");
    expect(enhancements).toContain('entry=role');
    for (const value of [
      "key: 'seller'", "key: 'buyer'", "key: 'operator'", "key: 'finance'",
      "perspective: 'seller'", "perspective: 'buyer'", "perspective: 'operator'", "perspective: 'bank'",
    ]) expect(copy).toContain(value);
    expect(copy).toContain('Выбор ракурса не меняет роль, права или доступ к данным');
    expect(enhancements).not.toContain('accessToken');
    expect(enhancements).not.toContain('tenantId');
    expect(enhancements).not.toContain('membership');
  });

  it('places the Deal cockpit before role, category and lifecycle explanation', () => {
    const hero = home.indexOf("className='pc-v6-hero pc-v6-hero-unified'");
    const cockpit = home.indexOf("className='pc-v6-control-tower pc-v6-control-tower-unified'");
    const scenario = home.indexOf("id='participants'");
    const roles = home.indexOf('<PublicRoleEntrances locale={locale} />');
    const category = home.indexOf("className='pc-v6-category'");
    const lifecycle = home.indexOf("id='deal-path'");
    expect(hero).toBeGreaterThan(-1);
    expect(cockpit).toBeGreaterThan(hero);
    expect(scenario).toBeGreaterThan(cockpit);
    expect(roles).toBeGreaterThan(scenario);
    expect(category).toBeGreaterThan(roles);
    expect(lifecycle).toBeGreaterThan(category);
  });

  it('keeps one dominant hero conversion and no repeated cockpit actions', () => {
    const firstHero = home.slice(home.indexOf("className='pc-v6-hero pc-v6-hero-unified'"), home.indexOf("id='participants'"));
    expect(firstHero.match(/className='pc-v6-primary'/g)?.length).toBe(1);
    expect(firstHero).toContain("eventName='hero_primary_cta'");
    expect(firstHero).toContain("eventName='hero_secondary_cta'");
    expect(firstHero).toContain("className='pc-v6-tai-strip pc-v6-tower-intelligence'");
    expect(firstHero).not.toContain("className='pc-v6-hero-proofs'");
    expect(firstHero).not.toContain("className='pc-v6-ct-actions'");
  });

  it('expresses platform and TAI as one meaning without duplicating the AI page', () => {
    expect(heroCopy).toContain("title: 'Одна Сделка.'");
    expect(heroCopy).toContain("accent: 'TAI помогает довести её до расчёта.'");
    expect(heroCopy).toContain('TAI показывает блокеры и следующий шаг');
    expect(home).toContain("const taiHref = `/platform-v7/ai-in-action");
    expect(home).toContain("<a href={taiHref}>{enhancement.nav.tai}</a>");
    expect(home).toContain("className='pc-v6-tower-intelligence-link'");
    expect(home).toContain("eventName='open_tai'");
    expect(home).not.toContain("<section id='tai' className='pc-v6-section pc-v6-tai'>");
    expect(home).not.toContain('Отдельный AI-продукт для агробизнеса');
    expect(home).not.toContain('<TaiImpact locale={locale} />');
    expect(home).not.toContain('<TaiWorkflow locale={locale} />');
  });

  it('does not introduce unverified proof or rejected partner wording', () => {
    const combined = `${home}\n${enhancements}\n${copy}\n${head}`.toLowerCase();
    for (const phrase of [
      'специализированные партнёры',
      'исполняют логистику, приёмку, лабораторию и расчёты',
      '35 регионов', '12 млн тонн', '20 000 перевозчиков',
      'банк подключён', 'фгис подключён', 'эдо подключён', 'боевой контур',
    ]) expect(combined).not.toContain(phrase);
  });

  it('keeps SEO and structured data aligned with Deal execution and TAI', () => {
    for (const value of [
      "pageTitle = 'Прозрачная Цена — контроль исполнения агросделки от цены до расчёта'",
      'TAI объясняет блокеры, риски и следующий шаг',
      'цифровая инфраструктура агросделки',
      'TAI Transparent Agro Intelligence',
      "name: 'Единый контур исполнения агросделки'",
      'hrefLang="x-default"', 'property="og:type"', 'name="twitter:card"',
    ]) expect(head).toContain(value);
    expect(head).not.toContain('контур исполнения зерновой сделки');
  });

  it('keeps public dock and legacy mobile CSS boundaries intact', () => {
    expect(contactDock).toContain("const PUBLIC_MOBILE_QUERY = '(max-width: 767px)'");
    expect(contactDock).toContain('const PUBLIC_HERO_THRESHOLD = 120');
    expect(contactDock).toContain('setHiddenByScroll(isPublicMobileTop(currentY))');
    expect(contactDock).toContain("mobileQuery.addEventListener('change', syncViewportVisibility)");
    expect(contactDock).toContain('}, [assistantContext]);');
    expect(contactDock).toContain('.pc-public-contact-dock-action:disabled {');
    expect(contactDock).toContain('-webkit-text-fill-color: currentColor;');
    expect(hydrationSupport).toContain("clean === '/platform-v7'");
    expect(hydrationSupport).not.toContain("import './PublicMobileExperiencePolish.css'");
    expect(legacyPolish).toContain("import './PublicMobileExperiencePolish.css'");
  });

  it('uses inline unified styles and preserves accessibility targets', () => {
    expect(enhancements).toContain("import './PlatformV7HomeMobileDensity.css'");
    expect(enhancements).toContain("import './PlatformV7HomeFinalPolish.css'");
    expect(enhancements).not.toContain('PlatformV7UnifiedHome.css');
    expect(home).not.toContain('PlatformV7UnifiedHome.module.css');
    expect(mobileDensityCss).toContain('content-visibility: visible !important');
    expect(finalCss).toContain('scroll-snap-type: x mandatory');
    expect(page).toContain('.pc-v6-tower-intelligence-link');
    expect(page).toContain('.pc-v6-trust-after-lifecycle');
    expect(page).toContain('width: 44px');
    expect(page).toContain('height: 44px');
    expect(page).toContain('@media (max-width: 767px)');
    expect(enhancementCss).toMatch(/min-height:\s*44px/);
    expect(enhancementCss).toContain(':focus-visible');
    expect(enhancementCss).toContain('@media (forced-colors: active)');
  });
});
