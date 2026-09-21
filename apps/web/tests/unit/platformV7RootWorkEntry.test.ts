import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, waitFor } from '@testing-library/react';
import { CanonicalDealWorkspace } from '@/components/platform-v7/CanonicalDealWorkspace';
import { CanonicalDealSpine, CanonicalStateLens, CanonicalStateTabs } from '@/components/platform-v7/PublicCanonicalPrimitives';
// Fixtures use the existing pure server policy; product code does not import it.
import { DEAL_ACTIONS, buildDealSpine, getCurrentDealAction } from '../../../api/src/modules/deals/deal-command.policy';

const read=(relativePath:string)=>readFileSync(join(process.cwd(),relativePath),'utf8');

describe('platform-v7 canonical public experience',()=>{
  const authority=read('../../DESIGN_AUTHORITY.md');
  const root=read('app/platform-v7/page.tsx');
  const layout=read('app/platform-v7/layout.tsx');
  const middleware=read('middleware.ts');
  const home=read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const primitives=read('components/platform-v7/PublicCanonicalPrimitives.tsx');
  const market=read('components/platform-v7/PublicCanonicalMarket.tsx');
  const marketSource=read('lib/public-market-server.ts');
  const routeAliases=read('lib/platform-v7/route-canonicalization.ts');
  const dealFlow=read('app/platform-v7/deal-flow/page.tsx');
  const protectedDeal=read('components/platform-v7/CanonicalDealWorkspace.tsx');
  const protectedDealRoute=read('app/platform-v7/deals/[id]/execution/page.tsx');
  const cleanDealAlias=read('app/platform-v7/deals/[id]/clean/page.tsx');
  const registerPage=read('app/platform-v7/register/page.tsx');
  const registerForm=read('app/platform-v7/register/RegisterFormClientPublic.tsx');
  const loginPage=read('app/platform-v7/login/page.tsx');
  const loginClient=read('app/platform-v7/login/LoginFormClient.tsx');
  const trust=read('app/platform-v7/trust/page.tsx');
  const gekta=read('app/platform-v7/ai-in-action/page.tsx');
  const css=read('styles/platform-v7-canonical-public-v1.css');
  const brand=read('components/v7r/BrandMark.tsx');
  const siteHeader=read('components/platform-v7/PublicSiteHeader.tsx');
  const gektaChatButton=read('components/platform-v7/PublicGektaChatButton.tsx');
  const operatorLoading=read('app/platform-v7/operator/loading.tsx');

  it('binds visual implementation to the explicit final mockup authority',()=>{
    expect(authority).toContain('Everything else is superseded.');
    for(const file of [
      '01-home-desktop.jpg','02-home-mobile.jpg','03-market-desktop.jpg','06-market-mobile.png',
      '04-lot-desktop.jpg','05-deal-desktop.jpg','06-deal-mobile.png','07-how-it-works-desktop.jpg',
      '08-trust-desktop.jpg','09-gekta-desktop.jpg',
    ]) expect(authority).toContain(file);
    expect(authority).toContain('922ce661af6031324424501f15e49dfe82570f8c6f72bd6fd112df2370b57420');
    expect(authority).toContain('2d2a3dd0940cc920b9ea87c847ba204d504c76c658f375fe397862adb838e8f2');
  });

  it('renders one canonical root and shared design system',()=>{
    expect(root).toContain("import '@/styles/platform-v7-canonical-home-v1.css'");
    expect(root).toContain('<PlatformV7StrategicHome/>');
    expect(home).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(home).toContain('CanonicalMarketPreview');
    expect(home).toContain('CanonicalDealSpine');
    expect(home).toContain('CanonicalTrustLedger');
    expect(home).toContain('CanonicalGektaStrip');
    expect(primitives).toContain('PublicGektaChatButton');
    expect(home).not.toContain('<style jsx>');
  });

  it('keeps one canonical navigation contract in RU EN ZH',()=>{
    for(const route of [
      '/platform-v7/market','/platform-v7/how-it-works','/platform-v7/capabilities',
      '/platform-v7/gekta','/platform-v7/trust','/platform-v7/about',
    ]) expect(primitives).toContain(route);
    for(const label of ['Рынок','Сделка','Возможности','Гекта','Доверие','О платформе']) expect(primitives).toContain(label);
    for(const label of ['Market','Deal','Capabilities','Gekta','Trust','About']) expect(primitives).toContain(label);
    for(const label of ['市场','交易','功能','Gekta','信任','关于平台']) expect(primitives).toContain(label);
  });

  it('keeps the protected operator route on the canonical neutral cockpit loading skeleton',()=>{
    expect(operatorLoading).toContain("from '@/components/platform-v7/RoleCockpitLoading'");
    expect(operatorLoading).toContain('<RoleCockpitLoading />');
    expect(operatorLoading).toContain("className='p7-route-loading'");
    expect(layout).toContain(".pc-shell-root-v4 .p7-route-loading{min-height:calc(100dvh - 136px)}");
    expect(operatorLoading).not.toContain('CanonicalUxState');
    expect(operatorLoading).not.toContain('pc-canonical-public');
  });

  it('opens Gekta through the existing public assistant authority without private context',()=>{
    expect(gektaChatButton).toContain("new CustomEvent('pc:public-assistant-context'");
    expect(gektaChatButton).toContain("context: 'platform'");
    expect(gektaChatButton).not.toContain('tenantId');
    expect(gektaChatButton).not.toContain('dealId');
    expect(gektaChatButton).not.toContain('documentId');
    expect(layout).toContain("<PublicContactDock assistantContext='public' publicMode='gekta' />");
    expect(layout).toContain('<HydrationSafeChatSupport renderDock={false} legacyPublicPolish={false} />');
  });


  it('keeps final public typography readable, consistent and free of templated copy',()=>{
    const homeCss=read('styles/platform-v7-canonical-home-v1.css');
    const assistantCss=read('styles/platform-v7-public-assistant-polish.css');
    const linkedCopy=[
      read('app/platform-v7/gekta/page.tsx'),
      read('app/platform-v7/ai-in-action/page.tsx'),
      read('app/platform-v7/trust/page.tsx'),
      read('app/platform-v7/about/page.tsx'),
      read('app/platform-v7/capabilities/page.tsx'),
      read('app/platform-v7/how-it-works/page.tsx'),
      read('app/platform-v7/head.tsx'),
      read('app/platform-v7/loading.tsx'),
    ].join('\n');
    const finalTypographyMarker='/* FINAL PUBLIC TYPOGRAPHY AUTHORITY — 2026-09-21';
    const assistantTypographyMarker='/* FINAL PUBLIC TYPOGRAPHY AUTHORITY — assistant 2026-09-21 */';

    for(const sheet of [homeCss,css]){
      const markerIndex=sheet.lastIndexOf(finalTypographyMarker);
      expect(markerIndex).toBeGreaterThan(0);
      const authority=sheet.slice(markerIndex);
      const pxSizes=[...authority.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((match)=>Number(match[1]));
      expect(pxSizes.length).toBeGreaterThan(0);
      expect(Math.min(...pxSizes)).toBeGreaterThanOrEqual(12);
      expect(authority).toContain('--pc-cp-ui:-apple-system');
      expect(authority).toContain('--pc-cp-display:-apple-system');
      expect(authority).not.toMatch(/Georgia|Times New Roman/);
      expect(authority).toContain('FINAL PUBLIC MICROTYPE COMPLETENESS');
    }

    const headerPxSizes=[...siteHeader.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((match)=>Number(match[1]));
    expect(Math.min(...headerPxSizes)).toBeGreaterThanOrEqual(12);

    const assistantMarkerIndex=assistantCss.lastIndexOf(assistantTypographyMarker);
    expect(assistantMarkerIndex).toBeGreaterThan(0);
    const assistantAuthority=assistantCss.slice(assistantMarkerIndex);
    const assistantPxSizes=[...assistantAuthority.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((match)=>Number(match[1]));
    expect(Math.min(...assistantPxSizes)).toBeGreaterThanOrEqual(12);

    for(const retired of [
      'Критическое состояние отвечает на пять вопросов',
      'Прозрачные сделки создают устойчивое будущее АПК',
      'The workspace shows actual state without replacing server data.',
      '关键状态回答五个问题',
      'Аграрный интеллект',
      'Agricultural intelligence',
      '农业智能',
      'authoritative financial state',
      'Роль и tenant',
      'Role and tenant',
      '角色与 tenant',
      'Интеграция или внешнее событие считаются подтверждёнными только после ответа внешней системы.',
      '可靠数据。更强农业。',
      '用可核验事实替代空泛承诺。',
      'Контекст. Аналитика. Обоснованные следующие шаги.',
      'Not a feature catalogue for its own sake',
      'Не каталог функций ради функций',
      'Один контекст, семь этапов, проверяемые факты.',
      'One context, seven stages, verifiable facts.',
    ]) expect(home + primitives + linkedCopy).not.toContain(retired);

    for(const humanCopy of [
      'Агросделка — от цены до закрытия.',
      'Экран сразу показывает, что произошло',
      'From price to closure — one Deal.',
      '从定价到结算，一笔交易贯穿全程。',
      'Помощник по Сделке',
      'Deal assistant',
      '交易助手',
      'Статус расчёта приходит с сервера и меняется только по подтверждённым событиям.',
      'Интеграция или внешнее событие считаются подтверждёнными только после фактического подтверждения внешней системой.',
      '事实、权限和决定都可核验。',
      'Market, execution, documents, settlement and closure stay connected.',
      'Семь этапов одной Сделки — с понятной ответственностью и документами.',
      'Загружаем подтверждённые данные.',
    ]) expect(home + primitives + linkedCopy).toContain(humanCopy);
  });

  it('locks the nine canonical roles and seven Deal stages',()=>{
    for(const role of ['Продавец','Покупатель','Логистика','Водитель','Элеватор','Лаборатория','Сюрвейер','Банк','Сотрудник подключённой организации']){
      expect(primitives).toContain(role);
    }
    for(const stage of ['Лот','Торги','Обязательства','Доставка','Приёмка / качество','Документы / расчёт','Закрытие / спор']){
      expect(primitives).toContain(stage);
    }
    expect(primitives).toContain('CANONICAL_ROLES');
    expect(primitives).toContain('CANONICAL_DEAL_STAGES');
  });

  it('uses the four-part trust model everywhere instead of maturity claims',()=>{
    for(const item of ['Полномочия','Основание','Источник','Решение']) expect(primitives).toContain(item);
    expect(trust).toContain('TRUST_MODEL');
    expect(trust).toContain('TRUST_DETAILS');
    expect(trust).toContain('pc-cp-trust-pillar');
    expect(protectedDeal).toContain('CanonicalTrustLedger');
    expect(home).toContain('CanonicalTrustLedger');
    expect(trust).not.toContain('provider-status');
  });

  it('makes the public market real-data-only and fail-closed',()=>{
    expect(market).toContain('getPublicMarketLots');
    expect(market).toContain("kind='unavailable'");
    expect(market).toContain("kind='empty'");
    expect(marketSource).toContain("source: 'POSTGRESQL'");
    expect(marketSource).toContain("projection: 'ANONYMIZED_PUBLIC_MARKET'");
    expect(marketSource).toContain("sellerIdentity: 'REDACTED'");
    expect(marketSource).toContain("row.tradePermission !== 'PUBLIC_ALLOWED'");
    expect(marketSource).toContain("tradePermission: 'PUBLIC_ALLOWED'");
    expect(market).not.toMatch(/ООО\s+(?:Ромашка|Тест|Агро)/);
    expect(market).not.toContain('DL-9102');
  });

  it('renders the canonical lot screen without exposing raw public identifiers or private seller data',()=>{
    expect(market).toContain('CanonicalPublicLotView');
    expect(market).toContain("data-testid='canonical-public-lot-view'");
    expect(market).toContain('lotIndex: number');
    expect(market).toContain('&lot=${publicIndex}');
    expect(market).not.toContain('encodeURIComponent(lot.publicRef)');
    expect(marketSource).toContain("sellerIdentity: 'REDACTED'");
    expect(market).toContain('Фото партии не опубликовано');
    expect(market).toContain('Документы доступны только участникам с подтверждёнными полномочиями.');
  });
  it('keeps public market public without weakening protected Deal routes',()=>{
    expect(layout).toContain("'/platform-v7/market'");
    expect(middleware).toContain("'/platform-v7/market'");
    const publicPrefixBlock=layout.slice(layout.indexOf('const PUBLIC_PREFIX_PATHS'),layout.indexOf('// Server redirects remain valid'));
    expect(publicPrefixBlock).not.toContain("'/platform-v7/market/'");
    expect(routeAliases).toContain("'/platform-v7/market': PLATFORM_V7_CANONICAL_ROUTES.lots");
    expect(layout.indexOf('if (isPublicPath(pathname))')).toBeLessThan(layout.indexOf('if (!isKnownProtectedPath(pathname))'));
    expect(layout).toContain("/^\\/platform-v7\\/deals\\/[^/]+$/");
    expect(layout).toContain("/^\\/platform-v7\\/lot\\/[^/]+$/");
    expect(layout.indexOf("'/platform-v7/market'")).toBeLessThan(layout.indexOf('if (!isKnownProtectedPath(pathname))'));
  });

  it('keeps registration intent informational while server authority remains external to the browser',()=>{
    expect(registerPage).toContain("type PublicRegistrationIntent = 'sell' | 'buy' | 'execution' | 'finance'");
    expect(registerPage).toContain('initialWorkspace={initialWorkspace}');
    expect(registerPage).toContain('verifyToken={verifyToken || undefined}');
    expect(registerPage).toContain('initialStatusToken={statusToken || undefined}');
    expect(registerForm).toContain("['seller', 'Продавец']");
    expect(registerForm).toContain("['bank', 'Банк']");
    expect(registerPage).not.toContain('tenantId=');
    expect(registerPage).not.toContain('setDirectRole');
  });

  it('preserves verified login and MFA flow without browser role selection',()=>{
    expect(loginPage).toContain('getPublicLoginCopy(locale)');
    expect(loginPage).toContain('<LoginFormClient copy={form} />');
    expect(loginClient).toContain("requestJson('/api/auth/login'");
    expect(loginClient).toContain("requestJson('/api/auth/mfa-login'");
    expect(loginClient).not.toContain('/api/platform-v7/cabinet-session');
    expect(loginClient).not.toContain('usePlatformV7RStore');
    expect(loginClient).not.toContain('sessionStorage');
    expect(loginClient).not.toContain('setDirectRole');
  });

  it('keeps the protected Deal on the authoritative execution workspace and governed command boundary',()=>{
    expect(protectedDealRoute).toContain('<CanonicalDealWorkspace role={role} dealId={id} />');
    expect(cleanDealAlias).toContain('/execution');
    expect(protectedDeal).toContain('/execution-workspace');
    expect(protectedDeal).toContain('/commands/${encodeURIComponent(action.id)}');
    expect(protectedDeal).toContain('expectedUpdatedAt: workspace.deal.updatedAt');
    expect(protectedDeal).toContain('expectedVersion: workspace.deal.version');
    expect(protectedDeal).toContain('applyCsrfHeader');
    expect(protectedDeal).toContain('reason.status === 409');
    expect(protectedDeal).toContain("action?.source === 'BANK_CALLBACK'");
    expect(protectedDeal).toContain('CanonicalDealSpine');
    expect(protectedDeal).toContain('CanonicalStateLens');
    expect(protectedDeal).toContain('CanonicalTrustLedger');
    expect(protectedDeal).not.toContain('DL-9102');
  });

  it('removes fabricated public Deal examples while retaining an explanatory Deal state lens',()=>{
    expect(dealFlow).toContain('CanonicalStateLens');
    expect(dealFlow).toContain('Платформа показывает основание для расчёта');
    expect(dealFlow).not.toContain('DL-9102');
    expect(dealFlow).not.toContain('4 860 000');
    expect(dealFlow).not.toContain('ООО');
  });

  it('keeps Gekta inside source and authority boundaries',()=>{
    expect(gekta).toContain('Решение принимает человек.');
    expect(gekta).toContain('Только данные, доступные текущему участнику');
    expect(gekta).toContain('Гекта объясняет; критическое действие выполняет уполномоченный участник');
    expect(gekta).not.toContain('автоматически переводит деньги');
  });

  it('keeps accessibility and responsive acceptance explicit',()=>{
    expect(css).toContain(':focus-visible');
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
    expect(css).toContain('@media(max-width:760px)');
    expect(css).toContain('@media(max-width:430px)');
    expect(css).toContain('min-height:48px!important');
    expect(css).toContain('overflow-x:clip');
    expect(css).toContain('env(safe-area-inset-bottom)');
  });

  it('keeps the repository canonical brand implementation rather than a generated replacement',()=>{
    expect(brand).toContain('ApprovedHeaderLogo');
    expect(brand).toContain("data-approved-brand-mark='owner-login-header-pixel-exact'");
    expect(siteHeader).toContain("data-brand-mark='transparent-price-canonical'");
    expect(primitives).toContain('PublicSiteHeader');
    expect(authority).toContain('ApprovedHeaderLogo');
  });

  it('keeps indexable public metadata with explicit locale alternates',()=>{
    const localizedMetadataRoutes=[
      ['app/platform-v7/page.tsx','/platform-v7'],
      ['app/platform-v7/market/page.tsx','/platform-v7/market'],
      ['app/platform-v7/how-it-works/page.tsx','/platform-v7/how-it-works'],
      ['app/platform-v7/capabilities/page.tsx','/platform-v7/capabilities'],
      ['app/platform-v7/ai-in-action/page.tsx','/platform-v7/ai-in-action'],
      ['app/platform-v7/gekta/page.tsx','/platform-v7/gekta'],
      ['app/platform-v7/trust/page.tsx','/platform-v7/trust'],
      ['app/platform-v7/deal-flow/page.tsx','/platform-v7/deal-flow'],
      ['app/platform-v7/about/page.tsx','/platform-v7/about'],
    ] as const;
    for(const [sourcePath,route] of localizedMetadataRoutes){
      const source=read(sourcePath);
      expect(source,sourcePath).toContain('generateMetadata');
      expect(source,sourcePath).toContain(`canonical:'${route}'`);
      expect(source,sourcePath).toContain(`ru:'${route}?lang=ru'`);
      expect(source,sourcePath).toContain(`en:'${route}?lang=en'`);
      expect(source,sourcePath).toContain(`zh:'${route}?lang=zh'`);
      expect(source,sourcePath).toContain('index:true');
      expect(source,sourcePath).toContain('follow:true');
    }
  });
});

describe('canonical overview does not invent server progress', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function markup(element: Parameters<typeof renderToStaticMarkup>[0]) {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(element);
    return container;
  }

  for (const locale of ['ru', 'en', 'zh']) {
    it(`shows unknown progress and state explicitly in ${locale}`, () => {
      const spine = markup(createElement(CanonicalDealSpine, { locale, currentIndex: null }));
      expect(spine.querySelectorAll('[data-state="unknown"]')).toHaveLength(7);
      expect(spine.querySelectorAll('[data-state="done"], [data-state="current"], [aria-current]')).toHaveLength(0);
      const lens = markup(createElement(CanonicalStateLens, {
        locale, state: null, happened: 'source event', actor: 'source actor',
        basis: 'source basis', settlement: 'source money', next: 'source action',
      }));
      expect(lens.querySelector('[data-canonical-state="unconfirmed"]')?.textContent).toBeTruthy();
      expect(lens.querySelectorAll('[data-active="true"], [aria-current], [role="tab"]')).toHaveLength(0);
      for (const value of ['source event', 'source actor', 'source basis', 'source money', 'source action']) {
        expect(lens.textContent).toContain(value);
      }
    });
  }

  for (const currentIndex of [null, -1, 7, 1.5, Number.NaN, Infinity, -Infinity]) {
    it(`does not clamp invalid progress ${String(currentIndex)} into completion`, () => {
      const result = markup(createElement(CanonicalDealSpine, { locale: 'ru', currentIndex }));
      expect(result.querySelectorAll('[data-state="unknown"]')).toHaveLength(7);
      expect(result.querySelectorAll('[data-state="done"], [data-state="current"]')).toHaveLength(0);
    });
  }

  for (const currentIndex of [0, 1, 2, 3, 4, 5, 6]) {
    it(`preserves the explicitly supplied illustrative stage ${currentIndex}`, () => {
      const result = markup(createElement(CanonicalDealSpine, { locale: 'en', currentIndex }));
      expect(result.querySelectorAll('[data-state="done"]')).toHaveLength(currentIndex);
      expect(result.querySelectorAll('[data-state="current"][aria-current="step"]')).toHaveLength(1);
      expect(result.querySelectorAll('[data-state="pending"]')).toHaveLength(6 - currentIndex);
    });
  }

  it('preserves the default public outline without using that default in a private Deal', () => {
    const result = markup(createElement(CanonicalDealSpine, { locale: 'ru' }));
    expect(result.querySelectorAll('[data-state="done"]')).toHaveLength(0);
    expect(result.querySelectorAll('[data-state="current"]')).toHaveLength(1);
    const workspaceSource = read('components/platform-v7/CanonicalDealWorkspace.tsx');
    expect(workspaceSource).toContain("<CanonicalDealSpine locale='ru' currentIndex={null}");
    expect(workspaceSource).toContain('state={null}');
    expect(workspaceSource).not.toContain('resolveCanonicalStageIndex');
    expect(workspaceSource).not.toContain("workspace.disputes.length > 0 ? 'dispute'");
  });

  for (const state of ['normal', 'deviation', 'dispute'] as const) {
    it(`announces the read-only ${state} indicator without fake interactive tabs`, () => {
      const result = markup(createElement(CanonicalStateTabs, { locale: 'ru', state }));
      expect(result.querySelectorAll('[role="listitem"]')).toHaveLength(3);
      expect(result.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
      expect(result.querySelector('[aria-current="true"]')?.getAttribute('data-state')).toBe(state);
      expect(result.querySelectorAll('[role="tab"], [role="tablist"], button')).toHaveLength(0);
    });
  }

  function fixture(status: string, disputeStatus?: string) {
    const current = getCurrentDealAction(status);
    return {
      deal: {
        id: 'product-stage-fixture', number: null, status, version: '3',
        updatedAt: '2026-09-20T00:00:00Z', culture: 'Тестовая культура', cropClass: null,
        volumeTons: '1', pricePerTon: '1', totalKopecks: '123456789012345678901', currency: 'RUB',
      },
      roleProjection: {
        role: 'BUYER', focus: 'Проверка серверного состояния', canAct: false,
        primaryAction: current ? {
          id: current.id, label: current.label, source: current.source ?? 'USER',
          enabled: false, waitingForRoles: [...current.roles],
        } : null,
      },
      attention: 'Серверное следующее действие', blockers: [] as string[],
      money: null as null | { status: string; amountKopecks: string; callbackState: string; bankRef: string },
      spine: buildDealSpine(status), shipments: [], documents: [], laboratory: [], acceptance: [],
      disputes: disputeStatus ? [{ id: 'product-dispute-fixture', status: disputeStatus, description: 'Тестовый спор' }] : [],
      timeline: [],
    };
  }

  async function renderWorkspace(workspace: ReturnType<typeof fixture>) {
    const sourceSnapshot = JSON.stringify(workspace);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => JSON.parse(sourceSnapshot) });
    vi.stubGlobal('fetch', fetchMock);
    const result = render(createElement(CanonicalDealWorkspace, { role: 'buyer', dealId: workspace.deal.id }));
    await waitFor(() => expect(result.container.querySelector('[data-canonical-seven-stage]')).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`/api/proxy/deals/${workspace.deal.id}/execution-workspace`, {
      method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' },
    });
    expect(JSON.stringify(workspace)).toBe(sourceSnapshot);
    return result.container;
  }

  it('keeps the Deal actor label server-authoritative when the client display role changes', async () => {
    const buyerAction = DEAL_ACTIONS.find((candidate) => candidate.roles.includes('BUYER') && candidate.source !== 'BANK_CALLBACK');
    expect(buyerAction).toBeTruthy();
    const workspace = fixture(buyerAction!.from);
    workspace.roleProjection.role = 'BUYER';
    workspace.roleProjection.canAct = true;
    workspace.roleProjection.primaryAction!.enabled = true;

    const sourceSnapshot = JSON.stringify(workspace);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => JSON.parse(sourceSnapshot) });
    vi.stubGlobal('fetch', fetchMock);
    const result = render(createElement(CanonicalDealWorkspace, { role: 'seller', dealId: workspace.deal.id }));
    await waitFor(() => expect(result.container.querySelector('[data-canonical-seven-stage]')).toBeTruthy());

    const actorCell = [...result.container.querySelectorAll('.pc-cp-state-cell')]
      .find((cell) => cell.querySelector('span')?.textContent === 'Кто действует');
    expect(actorCell?.querySelector('strong')?.textContent).toBe('Покупатель');
    expect(actorCell?.textContent).not.toContain('Продавец');

    result.rerender(createElement(CanonicalDealWorkspace, { role: 'operator', dealId: workspace.deal.id }));
    expect(actorCell?.querySelector('strong')?.textContent).toBe('Покупатель');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const workspaceSource = read('components/platform-v7/CanonicalDealWorkspace.tsx');
    expect(workspaceSource).toContain('const canonicalActor = actionActor(workspace.roleProjection)');
    expect(workspaceSource).toContain('serverRoleLabel(workspace.roleProjection.role)');
    expect(workspaceSource).not.toContain('roleLabel(role)');
  });

  for (const status of [...DEAL_ACTIONS.map((action) => action.from), 'CLOSED', 'UNRECOGNIZED_FUTURE_STATUS']) {
    it(`retains actual server steps without inferring seven-stage completion for ${status}`, async () => {
      const workspace = fixture(status);
      const container = await renderWorkspace(workspace);
      const overview = container.querySelector('[data-canonical-seven-stage]')!;
      expect(overview.querySelectorAll('[data-state="unknown"]')).toHaveLength(7);
      expect(overview.querySelectorAll('[data-state="done"], [data-state="current"], [data-active="true"]')).toHaveLength(0);
      const steps = [...container.querySelectorAll('ol li')];
      expect(steps).toHaveLength(workspace.spine.length);
      workspace.spine.forEach((step, index) => {
        expect(steps[index].textContent).toContain(step.label);
        expect(steps[index].textContent).toContain(step.state === 'done' ? 'Готово' : step.state === 'active' ? 'Сейчас' : 'Позже');
      });
    });
  }

  for (const disputeStatus of ['RESOLVED', 'CLOSED', 'CANCELLED', 'OPEN']) {
    it(`does not invent an aggregate dispute state from historical rows: ${disputeStatus}`, async () => {
      const workspace = fixture('DOCUMENTS_COMPLETE', disputeStatus);
      if (disputeStatus === 'OPEN') workspace.blockers = ['Серверный блокер открытого спора'];
      const container = await renderWorkspace(workspace);
      expect(container.querySelector('[data-canonical-state="unconfirmed"]')).toBeTruthy();
      expect(container.querySelectorAll('.pc-cp-state-tab[data-active="true"]')).toHaveLength(0);
      if (workspace.blockers.length) expect(container.textContent).toContain(workspace.blockers[0]);
    });
  }

  it('retains confirmed money facts and exact minor units without setting aggregate finality', async () => {
    const workspace = fixture('RELEASED');
    workspace.money = { status: 'RELEASED', amountKopecks: workspace.deal.totalKopecks, callbackState: 'CONFIRMED', bankRef: 'product-bank-fixture' };
    const container = await renderWorkspace(workspace);
    expect(container.querySelector('article[title="RELEASED"]')).toBeTruthy();
    expect(container.textContent).toContain('1 234 567 890 123 456 789,01 ₽');
    expect(container.querySelectorAll('[data-canonical-seven-stage] [data-state="done"]')).toHaveLength(0);
  });
});
