import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
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
  const dockCss = read('components/platform-v7/PublicContactDock.tsx');
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
    expect(trustPage).toContain('const lang = `?lang=${encodeURIComponent(locale)}`');
    expect(trustPage).toContain("href={`/platform-v7${lang}`}");
    expect(trustPage).toContain('brandHomeLabel={copy.brandHome}');
    expect(trustPage).toContain("href={`/platform-v7/login${lang}`}");
    expect(trustPage).toContain("href={`/platform-v7/register${lang}`}");
    expect(trustPage).not.toContain('rebrandTrustCopy');
    expect(trustPage).not.toContain('cloneElement');
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
    expect(dockCss).toContain('min-height: 48px');
    expect(dockCss).toContain('min-height:44px!important');
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
describe('bounded public linked-surface shell', () => {

const web = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path: string) => readFileSync(resolve(web, path), 'utf8');
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
// Immutable evidence binds to accepted parent 2100552142416743524f493954b6e6c86f0aa6e5.
const IMMUTABLE = {
  "app/platform-v7/terms/page.tsx": "7249d807e7df5e71a255947c2425882c5698e39133e112cd534dfb5dea701c18",
  "app/platform-v7/privacy/page.tsx": "c68e3d50bf3a984207a961882bb4e0564057303a180fe4c95af65d9f74798e85",
  "components/platform-v7/PrivacyPortalPanel.tsx": "4059be07e8891b06c3df9bfeb053b714f69cce42c9efcd9f696f6fb10d5c75a8",
  "app/platform-v7/register/RegisterFormClientPublic.tsx": "2cb7a40095626e7bd999c4ff24bb1a36003486ae9975ab7d666e5047f93b33ad",
  "app/platform-v7/register/RegisterCleanClient.tsx": "a189822f6b04b0a0a56fda9d712f72f47ae08450bd86b3c179706fedf679a138",
  "components/gekta/GektaChatWorkspace.tsx": "88dacf82fa78c68bf3888be9502b920c001072df59518c6e8a04ca838589001a",
  "components/gekta/GektaAccessGate.tsx": "e190a0cfa0d6e058175f5cacd649d35417817485c551931b1c962f1241da3f3b",
  "components/gekta/GektaConsentDialog.tsx": "c8ad6d3923699c24ca0f410e84b57b1f3284424f8ca4d97c72d20a8b0994b33e"
};
const AUTHORITY = {
  "layoutClassification": "8a471c78bd812c65a2dfe73ec5c0f8c7857340f437893e0fb1e3aef1713abff7",
  "layoutProtectedSuffix": "a5d7c858b010651ebb8ba00219d3faee69e9adacc149d9a1f200a8af235f5ca5",
  "registerQueryAuthority": "31c9587196ffaa4f801ce52101770970e8fa607f0eedb5acd62cddc277bd1bd2",
  "registerFormAndHero": "4cbf114f25a6eaa34d047772798bd4f9ba4bfc2217bdafc450cc01d10cf89feb",
  "dockBehavior": "0d7d883c19e1e3c248d4d834f138dcf76d5b54c617fc58e9607ac78ff93ede2d"
};

  for (const [path, expected] of Object.entries(IMMUTABLE)) {
    it(`preserves the exact protected source ${path}`, () => expect(sha(read(path))).toBe(expected));
  }
  it('does not alter route classification or protected authorization', () => {
    const layout = read('app/platform-v7/layout.tsx');
    expect(sha(layout.split('const LANDING_PATH')[1]!.split('export default async function')[0]!)).toBe(AUTHORITY.layoutClassification);
    expect(sha(layout.split('  // Staff remains')[1]!)).toBe(AUTHORITY.layoutProtectedSuffix);
    expect(layout.indexOf('if (isPublicPath(pathname))')).toBeLessThan(layout.indexOf('<PublicLinkedSurfaceShell'));
  });
  it('preserves registration tokens, locale cycling and the exact form props', () => {
    const register = read('app/platform-v7/register/page.tsx');
    expect(sha(register.split('type Locale')[1]!.split('  return (')[0]!)).toBe(AUTHORITY.registerQueryAuthority);
    expect(sha(register.slice(register.indexOf('        <section')))).toBe(AUTHORITY.registerFormAndHero);
    expect(register).toContain('localeQuery.toString()');
    expect(register).toContain('<PublicSiteHeader');
    expect(register).not.toContain('<header');
  });
  it('keeps dock commands, modal handling and focus restoration unchanged', () => {
    const dock = read('components/platform-v7/PublicContactDock.tsx');
    expect(sha(dock.split('const css =')[0]!)).toBe(AUTHORITY.dockBehavior);
    expect(read('styles/platform-v7-international-home-fix.css')).not.toContain('.pc-public-contact-dock');
    expect(read('app/pc-public-entry/platform-v7/home-approved-contact-dock.css')).not.toContain('.pc-public-contact-dock');
    expect(read('styles/platform-v7-public-register-reflow.css')).not.toContain('.pc-public-contact-dock');
  });
  it('wraps only the four named public documents and keeps the legal text visible', () => {
    const shell = read('components/platform-v7/PublicLinkedSurfaceShell.tsx');
    for (const path of ['terms','privacy','oferta','docs']) expect(shell).toContain(`/platform-v7/${path}`);
    expect(shell).toContain("<main className='pc-linked-policy' lang='ru'>{children}</main>");
    expect(shell).toContain('not a translation of the consent document');
    expect(shell).toContain('不是同意文件的译文');
    expect(shell).not.toContain('cloneElement');
    expect(shell).not.toContain('dangerouslySetInnerHTML');
    expect(shell).not.toContain("import { PrivacyPortalPanel");
    expect(shell).not.toContain('fetch(');
  });
  it('uses localized informational pages without inventing an operator or a live integration', () => {
    for (const path of ['docs','oferta']) {
      const source = read(`app/platform-v7/${path}/page.tsx`);
      expect(source).toContain('Record<Locale, Copy>');
      for (const locale of ['ru','en','zh']) expect(source).toContain(`${locale}: {`);
      expect(source).toContain('export async function generateMetadata');
      expect(source).not.toContain('<header');
      expect(source).not.toContain('controlled pilot');
    }
    expect(read('app/platform-v7/oferta/page.tsx')).toContain('не является офертой от имени неподтверждённого оператора');
    expect(read('app/platform-v7/docs/page.tsx')).toContain('публичная страница не подписывает и не отправляет документы');
  });
  it('keeps Gekta workspace mounted while discovery chrome follows the existing entered-chat state', () => {
    const frame = read('components/gekta/GektaExperienceFrame.tsx');
    expect(frame.match(/<GektaChatWorkspace /g)).toHaveLength(1);
    expect(frame).toContain("data-gekta-experience={enteredChat ? 'chat' : 'discovery'}");
    expect(frame).toContain('!enteredChat && publicHeader');
    expect(frame).toContain('discoveryHero={enteredChat ? undefined : hero}');
    expect(frame).toContain('onEnteredChat={() => setEnteredChat(true)}');
    const drawer = read('components/gekta/GektaMobileDrawer.tsx');
    expect(drawer).toContain("[data-gekta-public-header='true']");
    expect(drawer).toContain("else element.removeAttribute('inert')");
    expect(drawer).toContain('useDialogFocus(open, onClose)');
  });
});

describe('Platform V7 public Trust surface', () => {
  const page = read('app/platform-v7/trust/page.tsx');
  const supportRuntime = read('components/platform-v7/ContextualSupportOrAssistant.tsx');
  it('explains trust through Deal architecture rather than maturity or provider-status presentation', () => {
    expect(page).toContain('Полномочия принадлежат участнику, а не экрану');
    expect(page).toContain('У Сделки одна связная история');
    expect(page).toContain('Внешние системы остаются отдельными контурами');
    expect(page).toContain('Гекта помогает понять, но не становится стороной Сделки');

    expect(page).not.toContain('verifiedLabel');
    expect(page).not.toContain('verifiedText');
    expect(page).not.toContain('неподтверждённый статус');
    expect(page).not.toContain('confirmed production exchange');
    expect(page).not.toContain('external availability');
    expect(page).not.toContain('live bank');
  });

  it('keeps the same trust model in RU EN ZH', () => {
    expect(page).toContain('Публичный выбор роли не назначает права.');
    expect(page).toContain('Choosing a role on a public page does not grant permissions.');
    expect(page).toContain('在公开页面选择角色不会授予权限。');

    expect(page).toContain('У Гекты нет самостоятельного права изменить Сделку, перевести деньги или принять критическое решение.');
    expect(page).toContain('Gekta has no independent authority to change a Deal, move money or make a critical decision.');
    expect(page).toContain('Gekta 没有独立权限自行修改交易、转移资金或作出关键决定。');
  });

  it('uses registration as the primary conversion path without granting authority from the public page', () => {
    expect(page).toContain("href={`/platform-v7/register${lang}`} className='pc-trust-primary'");
    expect(page).toContain("className='pc-v6-header-cta pc-trust-header-register'");
    expect(page).toContain('публичные примеры на этой странице прав не назначают');
    expect(page).toContain('public examples on this page do not grant permissions');
    expect(page).toContain('本页公开示例不会授予权限');
  });

  it('keeps the canonical public header, locale continuity and linked public routes', () => {
    expect(page).toContain('<PublicSiteHeader');
    expect(page).toContain('localeControl={<PublicLocaleLink />}');
    expect(page).toContain('/platform-v7/how-it-works${lang}');
    expect(page).toContain('/platform-v7/about${lang}');
    expect(page).toContain('/platform-v7/contact${lang}');
    expect(page).toContain('/platform-v7/privacy${lang}');
  });

  it('keeps Trust on the public assistant/support authority instead of the private-workspace runtime', () => {
    expect(supportRuntime).toContain("'/platform-v7/trust',");
    expect(supportRuntime).toContain('{renderDock ? <PublicContactDock /> : null}');
    expect(supportRuntime).toContain("<AiAssistantPanel variant='floating' />");
  });

  it('keeps Login reachable on 320px while preserving the registration CTA in the header', () => {
    expect(page).toContain("className='pc-trust-nav-login'");
    expect(page).toContain("className='entry-login pc-trust-header-login'");
    expect(page).toContain("registerShort: 'Регистрация'");
    expect(page).toContain("registerShort: 'Register'");
    expect(page).toContain("registerShort: '注册'");
    expect(page).toContain("@media(max-width:430px){.pc-trust-page .pc-site-header[data-public-site-header='canonical'] .pc-trust-header-login{display:none!important}");
    expect(page).toContain('.pc-site-mobile-nav .pc-trust-nav-login{display:flex}');
  });

  it('preserves the established Trust acceptance anchors without restoring the old document-like page', () => {
    expect(page).toContain("className='pc-trust-grid pc-trust-domains'");
    expect(page).toContain("const CARD_IDS = ['controls', 'history', 'external', 'ai'] as const;");
    expect(page).toContain('Критические решения подтверждает уполномоченный участник.');
    expect(page).toContain('Платформа не заявляет без доказательств');
  });

  it('keeps mobile, reduced-motion and forced-colors behavior explicit', () => {
    expect(page).toContain('@media(max-width:600px)');
    expect(page).toContain('@media(prefers-reduced-motion:reduce)');
    expect(page).toContain('@media(forced-colors:active)');
    expect(page).toContain('.pc-trust-path{grid-template-columns:1fr}');
    expect(page).toContain('.pc-trust-page .pc-site-brand{min-height:44px}');
    expect(page).toContain('min-height:48px');
  });
});
