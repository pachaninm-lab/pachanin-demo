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
  const unifiedCss = read('components/platform-v7/PlatformV7UnifiedHome.module.css');
  const copy = read('i18n/platform-v7-home-enhancements.ts');
  const heroCopy = read('i18n/platform-v7-hero-message.ts');
  const head = read('app/platform-v7/head.tsx');
  const contactDock = read('components/platform-v7/PublicContactDock.tsx');
  const hydrationSupport = read('components/platform-v7/HydrationSafeChatSupport.tsx');
  const legacyPolish = read('components/platform-v7/LegacyPublicMobileExperiencePolish.tsx');

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

  it('places the concrete Deal workspace before role, category and lifecycle explanation', () => {
    const scenarioIndex = home.indexOf("id='participants'");
    const rolesIndex = home.indexOf('<PublicRoleEntrances locale={locale} />');
    const categoryIndex = home.indexOf("className='pc-v6-category'");
    const lifecycleIndex = home.indexOf("id='deal-path'");
    expect(scenarioIndex).toBeGreaterThan(-1);
    expect(rolesIndex).toBeGreaterThan(scenarioIndex);
    expect(categoryIndex).toBeGreaterThan(rolesIndex);
    expect(lifecycleIndex).toBeGreaterThan(categoryIndex);
  });

  it('keeps one dominant hero conversion and shows the product cockpit before secondary content', () => {
    const firstHero = home.slice(home.indexOf("className={`pc-v6-hero ${styles.hero}`}"), home.indexOf("id='participants'"));
    expect(firstHero.match(/className='pc-v6-primary'/g)?.length).toBe(1);
    expect(firstHero).toContain("eventName='hero_primary_cta'");
    expect(firstHero).toContain("eventName='hero_secondary_cta'");
    expect(firstHero.indexOf("className={`pc-v6-control-tower ${styles.tower}`}")).toBeGreaterThan(firstHero.indexOf("className={`pc-v6-hero-copy ${styles.heroCopy}`}"));
    expect(firstHero).toContain("className={`pc-v6-tai-strip ${styles.towerIntelligence}`}");
    expect(firstHero).not.toContain("className='pc-v6-hero-proofs'");

    const finalSection = home.slice(home.indexOf("className='pc-v6-final'"));
    const dealPrimary = finalSection.indexOf("href={dealHref} className='pc-v6-primary'");
    const connectSecondary = finalSection.indexOf("href='#connect-organization' className='pc-v6-secondary'");
    expect(dealPrimary).toBeGreaterThan(-1);
    expect(connectSecondary).toBeGreaterThan(dealPrimary);
  });

  it('expresses the platform and TAI as one product meaning without duplicating the dedicated AI page', () => {
    expect(heroCopy).toContain("title: 'Вся агросделка'");
    expect(heroCopy).toContain("accent: 'с TAI внутри'");
    expect(heroCopy).toContain('TAI видит блокеры, объясняет основания и готовит следующий шаг');
    expect(home).toContain("const taiHref = `/platform-v7/ai-in-action");
    expect(home).toContain("<a href={taiHref}>{enhancement.nav.tai}</a>");
    expect(home).toContain("id='tai'");
    expect(home).toContain('TAI работает внутри всего контура Сделки');
    expect(home).toContain("eventName='open_tai'");
    expect(home).not.toContain("<section id='tai' className='pc-v6-section pc-v6-tai'>");
    expect(home).not.toContain('Отдельный AI-продукт для агробизнеса');
    expect(home).not.toContain('<TaiImpact locale={locale} />');
    expect(home).not.toContain('<TaiWorkflow locale={locale} />');
    expect(copy).toContain('Как TAI формирует ответ');
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

  it('keeps contact-dock contrast rules inside the owning component', () => {
    expect(enhancements).not.toContain('CONTACT_DOCK_CONTRAST_BOUNDARY');
    expect(enhancements).not.toContain('.pc-public-contact-dock');
    expect(contactDock).toContain('transition: transform .2s ease, visibility .18s ease;');
    expect(contactDock).not.toContain('opacity .18s ease');
    expect(contactDock).toContain('.pc-public-contact-dock-action:disabled {');
    expect(contactDock).toContain('color: inherit;');
    expect(contactDock).toContain('opacity: 1;');
    expect(contactDock).toContain('-webkit-text-fill-color: currentColor;');
  });

  it('keeps the public mobile dock off the first screen without changing private or desktop behavior', () => {
    expect(contactDock).toContain("const PUBLIC_MOBILE_QUERY = '(max-width: 767px)'");
    expect(contactDock).toContain('const PUBLIC_HERO_THRESHOLD = 120');
    expect(contactDock).toContain("React.useState(assistantContext === 'public')");
    expect(contactDock).toContain('const mobileQuery = window.matchMedia(PUBLIC_MOBILE_QUERY)');
    expect(contactDock).toContain("assistantContext === 'public'");
    expect(contactDock).toContain('setHiddenByScroll(isPublicMobileTop(currentY))');
    expect(contactDock).toContain("mobileQuery.addEventListener('change', syncViewportVisibility)");
    expect(contactDock).toContain('}, [assistantContext]);');
  });

  it('loads legacy public mobile CSS only outside the strategic homepage', () => {
    expect(hydrationSupport).toContain("import { usePathname } from 'next/navigation'");
    expect(hydrationSupport).toContain("clean === '/platform-v7'");
    expect(hydrationSupport).toContain("clean === '/pc-public-entry/platform-v7'");
    expect(hydrationSupport).toContain('const loadLegacyPublicPolish = legacyPublicPolish ?? !isStrategicHomepage(pathname)');
    expect(hydrationSupport).not.toContain("import './PublicMobileExperiencePolish.css'");
    expect(legacyPolish).toContain("import './PublicMobileExperiencePolish.css'");
  });

  it('eliminates reserved blank sections and keeps the mobile conversion path compact', () => {
    expect(enhancements).toContain("import './PlatformV7HomeMobileDensity.css'");
    expect(enhancements).toContain("import './PlatformV7HomeFinalPolish.css'");
    expect(mobileDensityCss).toContain('content-visibility: visible !important');
    expect(mobileDensityCss).toContain('contain-intrinsic-size: none !important');
    expect(finalCss).toContain('.pc-v7-public-entry .pc-v6-role-grid');
    expect(finalCss).toContain('scroll-snap-type: x mandatory');
    expect(home).toContain("import styles from './PlatformV7UnifiedHome.module.css'");
    expect(unifiedCss).toContain('.heroTitleAccent');
    expect(unifiedCss).toContain('.lifecycleIntelligence');
    expect(unifiedCss).toContain('grid-template-columns: auto minmax(0, 1fr) auto');
  });

  it('keeps mobile-first navigation, minimum targets, accessibility focus and reduced motion', () => {
    expect(enhancementCss).toContain('scroll-snap-type: x mandatory');
    expect(enhancementCss).toMatch(/min-height:\s*44px/);
    expect(enhancementCss).toContain(':focus-visible');
    expect(enhancementCss).toContain('@media (max-width: 767px)');
    expect(enhancementCss).toContain('@media (min-width: 768px)');
    expect(enhancementCss).toContain('@media (min-width: 1100px)');
    expect(unifiedCss).toContain('min-height: 44px');
    expect(unifiedCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(enhancementCss).toContain('@media (forced-colors: active)');
  });
});
