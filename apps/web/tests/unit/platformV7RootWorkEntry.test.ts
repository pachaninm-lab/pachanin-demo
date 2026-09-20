import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read=(relativePath:string)=>readFileSync(join(process.cwd(),relativePath),'utf8');

describe('platform-v7 canonical public experience',()=>{
  const authority=read('../../DESIGN_AUTHORITY.md');
  const root=read('app/platform-v7/page.tsx');
  const layout=read('app/platform-v7/layout.tsx');
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
    expect(root).toContain("import '@/styles/platform-v7-canonical-public-v1.css'");
    expect(root).toContain('<PlatformV7StrategicHome/>');
    expect(home).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(home).toContain('CanonicalMarketPreview');
    expect(home).toContain('CanonicalDealSpine');
    expect(home).toContain('CanonicalTrustLedger');
    expect(home).toContain('CanonicalGektaStrip');
    expect(home).not.toContain('<style jsx>');
  });

  it('keeps one canonical navigation contract in RU EN ZH',()=>{
    for(const route of [
      '/platform-v7/market','/platform-v7/how-it-works','/platform-v7/capabilities',
      '/platform-v7/ai-in-action','/platform-v7/trust','/platform-v7/about',
    ]) expect(primitives).toContain(route);
    for(const label of ['Рынок','Как проходит Сделка','Возможности','Гекта','Доверие','О платформе']) expect(primitives).toContain(label);
    for(const label of ['Market','How the Deal works','Capabilities','Trust','About']) expect(primitives).toContain(label);
    for(const label of ['市场','交易如何进行','功能','信任','关于平台']) expect(primitives).toContain(label);
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
    expect(trust).toContain('CanonicalTrustLedger');
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

  it('keeps public market public without weakening protected Deal routes',()=>{
    expect(layout).toContain("'/platform-v7/market'");
    expect(layout).not.toContain("'/platform-v7/market/'");
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
    expect(gekta).toContain('Критическое решение остаётся за человеком и правилами платформы');
    expect(gekta).toContain('Только контекст, доступный текущему участнику');
    expect(gekta).toContain('Гекта объясняет; критическое действие не исполняет самостоятельно');
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
    expect(root).toContain("canonical:'/platform-v7'");
    expect(root).toContain("ru:'/platform-v7?lang=ru'");
    expect(root).toContain("en:'/platform-v7?lang=en'");
    expect(root).toContain("zh:'/platform-v7?lang=zh'");
    expect(root).toContain('index:true');
    expect(root).toContain('follow:true');
  });
});
