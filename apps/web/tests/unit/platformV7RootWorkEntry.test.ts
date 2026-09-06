import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 final public entry', () => {
  const layout = read('app/platform-v7/layout.tsx');
  const page = read('app/platform-v7/page.tsx');
  const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const homeCopy = read('i18n/platform-v7-home-v3-operating.ts');
  const storyCopy = read('i18n/platform-v7-home-story-product.ts');
  const heroCopy = read('i18n/platform-v7-hero-message.ts');
  const homeCss = read('styles/platform-v7-strategic-home-v3.css');
  const storyCss = read('components/platform-v7/PlatformV7StrategicHomeStory.module.css');
  const dockCss = read('app/pc-public-entry/platform-v7/home-approved-contact-dock.css');
  const finalCss = read('components/platform-v7/PlatformV7HomeFinalPolish.css');
  const explorerPage = read('app/platform-v7/how-it-works/page.tsx');
  const trustPage = read('app/platform-v7/trust/page.tsx');
  const explorer = read('components/platform-v7/PublicDealExplorer.tsx');
  const explorerAdapter = read('components/platform-v7/PublicDealExplorerV4.tsx');
  const entryGate = read('components/platform-v7/PublicDealEntryGate.tsx');
  const support = read('components/platform-v7/ChatSupportWidget.tsx');
  const siteHeader = read('components/platform-v7/PublicSiteHeader.tsx');
  const aiExperience = read('components/platform-v7/PublicAiInActionSimpleExperience.tsx');

  it('renders the full public narrative, trust layer, final registration CTA and optional assistance form', () => {
    expect(page).toContain('const home = await PlatformV7StrategicHome();');
    for (const anchor of [
      "id='participants'",
      "id='difference'",
      "id='deal-path'",
      "id='functions'",
      "id='live'",
      "id='trust'",
      "id='tai'",
      "id='faq'",
    ]) expect(home).toContain(anchor);
    expect(home).not.toContain("id='maturity'");
    expect(home).not.toContain("id='integrations'");
    expect(home).toContain("aria-labelledby='registration-title'");
    expect(home).toContain('<PublicDealRoleScenario locale={locale} />');
    expect(home).toContain('<OrganizationConnectForm locale={locale} />');
  });

  it('publishes one seven-step ordinary journey without marketing the internal 19-stage model', () => {
    for (const title of [
      'Товар и условия',
      'Торги и контрагент',
      'Сделка и договор',
      'Логистика и поставка',
      'Приёмка и качество',
      'Документы и основания расчёта',
      'Расчёт и закрытие',
    ]) expect(storyCopy).toContain(`title: '${title}'`);
    expect(storyCopy).toContain("journey: '7 шагов'");
    expect(storyCopy).toContain("fullPathLabel: 'Обычный путь'");
    expect(storyCopy).not.toContain("fullPathText: '19 этапов");
    expect(homeCopy).toContain("phases: ['Товар и условия', 'Торги и контрагент', 'Сделка и договор'");
    expect(home).toContain("className='pc-v6-lifecycle'");
  });

  it('preserves the public walkthrough while collapsing staff subroles to one public employee perspective', () => {
    expect(explorerPage).toContain("stage: 'terms'");
    expect(explorerPage).toContain("perspective: 'buyer'");
    expect(home).toContain('stage=terms&lens=execution&perspective=buyer');
    expect(explorerAdapter).toContain('normalizeTourStateFromSearchParams');
    expect(explorerAdapter).toContain("window.addEventListener('popstate', restorePublicHistoryState)");
    expect(explorer).toContain("const PUBLIC_PERSPECTIVES: readonly TourPerspective[] = ['seller', 'buyer', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'bank', 'operator']");
    expect(explorerAdapter).toContain("const STAFF_PERSPECTIVES = new Set<TourPerspective>(['operator', 'compliance', 'arbitrator', 'executive'])");
    expect(explorer).toContain('PUBLIC_PERSPECTIVES.map');
    expect(explorer).not.toContain('TOUR_PERSPECTIVES.map');
    expect(entryGate).toContain('не влияет на права доступа');
    expect(home).not.toContain('/platform-v7/login?role=');
  });

  it('preserves RU EN ZH across the detailed Deal route and its registration CTA', () => {
    expect(explorerPage).toContain('const localizedHref = (path: string) => `${path}?lang=${encodeURIComponent(normalizedLocale)}`');
    expect(explorerPage).toContain("href={localizedHref('/platform-v7/about')}");
    expect(explorerPage).toContain("href={localizedHref('/platform-v7/contact')}");
    expect(explorerPage).toContain("const registerHref = localizedHref('/platform-v7/register')");
    expect(explorer).toContain('const registerHref = `/platform-v7/register?lang=${encodeURIComponent(localizedLocale)}`');
    expect(explorer).toContain('href={registerHref}');
  });

  it('preserves RU EN ZH through Gekta and quick Deal completion CTAs', () => {
    expect(aiExperience).toContain('const localeSuffix = `?lang=${encodeURIComponent(localeKey)}`');
    expect(aiExperience).toContain('const dealHref = `${homeHref}#deal-path`');
    expect(aiExperience).toContain('const registerHref = `/platform-v7/register${localeSuffix}`');
    expect(aiExperience).toContain('href={dealHref}');
    expect(aiExperience).toContain('href={registerHref}');
    expect(aiExperience).toContain('href={homeHref}');
    expect(aiExperience).not.toContain("href='/platform-v7#deal-path'");
    expect(aiExperience).not.toContain("href='/platform-v7/register' className={styles.primary}");
    expect(explorerAdapter).toContain('const registerHref = `/platform-v7/register?lang=${encodeURIComponent(normalizedLocale)}`');
    expect(explorerAdapter).toContain('href={registerHref}');
    expect(explorerAdapter).not.toContain("<a href='/platform-v7/register' className='pc-ppe-primary-button'");
  });

  it('keeps the shared brand-home link locale-safe while retaining the legacy fallback', () => {
    expect(siteHeader).toContain("href.startsWith('/platform-v7')");
    expect(siteHeader).toContain("href.match(/[?&]lang=(ru|en|zh)(?:&|#|$)/)");
    expect(siteHeader).toContain("return locale ? `/platform-v7?lang=${locale}` : '/platform-v7'");
    expect(siteHeader).toContain('brandHomeHref?: string;');
    expect(siteHeader).toContain('href={resolvedBrandHomeHref}');
    expect(siteHeader).not.toContain("<a href='/platform-v7' className='pc-site-brand'");
  });

  it('preserves RU EN ZH when returning from the linked Trust Center', () => {
    expect(trustPage).toContain("if (element.props.href === '/platform-v7')");
    expect(trustPage).toContain('nextProps.href = `/platform-v7?lang=${locale}`');
    expect(trustPage).toContain('nextProps.actions = rebrandTrustCopy(element.props.actions, locale)');
    expect(trustPage).not.toContain('return cloneElement(element, undefined, ...children)');
  });

  it('states external-system boundaries without false-live language or internal jargon', () => {
    const combined = `${page}\n${home}\n${homeCopy}\n${storyCopy}`.toLowerCase();
    for (const token of [
      'production-ready',
      'fully live',
      'банк подключён',
      'фгис подключён',
      'эдо подключён',
      'confirmed_live',
      'integration connected',
      'controlled pilot',
      'pre-integration',
      'not_attested',
      'готовность расчёта',
      'settlement readiness',
    ]) expect(combined).not.toContain(token);
    expect(home).toContain('платформа не приписывает им действий без внешнего основания');
    expect(storyCopy).toContain('Внешние системы используются через отдельные управляемые адаптеры');
    expect(storyCopy).toContain('Схема обмена и права организации определяются до передачи данных.');
  });

  it('ships explicit RU EN ZH copy and the approved crop hero', () => {
    expect(storyCopy).toContain('ru: {');
    expect(storyCopy).toContain('en: {');
    expect(storyCopy).toContain('zh: {');
    expect(heroCopy).toContain("title: 'Manage an agricultural Deal'");
    expect(heroCopy).toContain("title: '管理农业交易'");
    expect(heroCopy).toContain("title: 'Управляйте агросделкой'");
  });

  it('preserves mobile, touch-target, reduced-motion and help gates', () => {
    expect(layout).toContain('.pc-shell-root-v4 .p7-route-loading{min-height:calc(100dvh - 136px)}');
    expect(homeCss).toContain('@media (max-width: 767px)');
    expect(homeCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(storyCss).toMatch(/@media\s*\(max-width:\s*767px\)/);
    expect(storyCss).toMatch(/@media\s*\(max-width:\s*359px\)/);
    expect(storyCss).toMatch(/@media\s*\(forced-colors:\s*active\)/);
    expect(storyCss).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(dockCss).toContain('min-height: 46px');
    expect(finalCss).toContain('min-height: 44px !important');
    expect(support).toContain("role='dialog'");
    expect(support).toContain("aria-modal='true'");
  });

  it('keeps site landmarks and responsive disclosures available to assistive technology', () => {
    expect(home).toContain("className={`pc-v6-page pc-v7-public-entry ${styles.root}`}");
    expect(home).toContain("<main id='main-content' tabIndex={-1}>");
    expect(home).not.toContain('<aside');
    expect(home.match(/pc-v6-control-tower/g)).toHaveLength(1);
    for (const id of ['difference-more-toggle', 'functions-more-toggle', 'phases-more-toggle']) {
      expect(home).toContain(`id='${id}'`);
    }
    expect(storyCss).toContain('.root :global(.pc-site-header)');
    expect(storyCss).toContain('font-family: var(--pc-entry-font-body) !important');
    expect(storyCss).toContain('.moreContentToggle:focus-visible ~ .moreContentLabel');
  });

  it('keeps comparison data in a valid accessible table structure', () => {
    expect(home).toContain("className={styles.comparisonTable} role='table' aria-labelledby='difference-title'");
    expect(home.match(/className=\{styles\.comparisonTable\} role='table'/g)).toHaveLength(1);
    expect(home).toContain("id='difference-comparison-rows' className={styles.comparisonRows} role='rowgroup'");
    expect(home).toContain("data-comparison-row='true'");
    expect(home).toContain("<strong role='rowheader'>{row.criterion}</strong>");
    expect(home).not.toMatch(/<article[^>]+role='row'/);
  });
});

describe('owner registration cancellation acceptance', () => {
  const queue = read('components/platform-v7/staff/RegistrationReviewQueue.tsx');
  const bff = read('app/api/staff/registration/applications/[applicationId]/cancel/route.ts');

  it('keeps the destructive action owner-only and removes the successful card in-place', () => {
    expect(queue).toContain("sessionPayload.session?.staffRole === 'PLATFORM_OWNER'");
    expect(queue).toContain("cancel: 'Удалить заявку'");
    expect(queue).toContain('Заявка удалена из очереди.');
    expect(queue).toContain('setApplications((current) => current.filter((item) => item.applicationId !== application.applicationId))');
    expect(queue).toContain('/cancel`');
    expect(queue).toContain("'Idempotency-Key': headers.idempotencyKey");
    expect(queue).toContain("'X-Correlation-Id': headers.correlationId");
    expect(queue).toContain("'X-CSRF-Token': csrfToken");
  });

  it('keeps the bounded BFF server-authoritative and forwards the required security context', () => {
    expect(bff).toContain('assertCsrf(request)');
    expect(bff).toContain("const STAFF_ACCESS_COOKIE = 'pc_staff_access_token'");
    expect(bff).toContain("'x-staff-access-session': staffAccessToken");
    expect(bff).toContain("'x-correlation-id': correlationId");
    expect(bff).toContain("'idempotency-key': idempotencyKey");
    expect(bff).toContain('/staff/registration/applications/${encodeURIComponent(applicationKey)}/cancel');
    expect(bff).not.toMatch(/\bDELETE\b/);
  });
});
