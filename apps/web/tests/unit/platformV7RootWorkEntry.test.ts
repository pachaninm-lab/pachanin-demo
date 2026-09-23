import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classifyRegistrationStatusResponse,
  classifyRegistrationSubmitResponse,
  parseRegistrationStatusSnapshot,
  registrationOperationForPayload,
} from '@/lib/platform-v7/registration-outcome';
import { createElement, isValidElement, type ReactNode, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { CanonicalDealWorkspace } from '@/components/platform-v7/CanonicalDealWorkspace';
import { CanonicalDealSpine, CanonicalStateLens, CanonicalStateTabs } from '@/components/platform-v7/PublicCanonicalPrimitives';
// Fixtures use the existing pure server policy; product code does not import it.
import { DEAL_ACTIONS, buildDealSpine, getCurrentDealAction } from '../../../api/src/modules/deals/deal-command.policy';

import { PUBLIC_CROPS, PUBLIC_CROP_LABELS, findPublicLot, publicLotReference, marketApplicationHref, publicMarketContext, marketHref, publicMarketLocaleHref, publicMarketRegistrationContext } from '@/lib/platform-v7/public-market-navigation';
import { CanonicalCropCatalogue, CanonicalMarketPreview, CanonicalMarketResults, CanonicalPublicLotView } from '@/components/platform-v7/PublicCanonicalMarket';
import { PublicMarketDeadline } from '@/components/platform-v7/PublicMarketDeadline';
import RegisterPage from '@/app/platform-v7/register/page';
import { RegisterFormClientPublic } from '@/app/platform-v7/register/RegisterFormClientPublic';
import type { PublicMarketLot, PublicMarketReadResult } from '@/lib/public-market-server';

const read=(relativePath:string)=>readFileSync(join(process.cwd(),relativePath),'utf8');

describe('platform-v7 canonical public experience',()=>{
  const authority=read('../../DESIGN_AUTHORITY.md');
  const root=read('app/platform-v7/page.tsx');
  const layout=read('app/platform-v7/layout.tsx');
  const middleware=read('middleware.ts');
  const home=read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const primitives=read('components/platform-v7/PublicCanonicalPrimitives.tsx');
  const market=read('components/platform-v7/PublicCanonicalMarket.tsx');
  const marketPage=read('app/platform-v7/market/page.tsx');
  const capabilitiesPage=read('app/platform-v7/capabilities/page.tsx');
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
    expect(primitives).toContain("['Сделка', '/platform-v7/deal-flow', Layers3, false]");
    expect(primitives).not.toContain("['Регистрация', '/platform-v7/register', UserRound, true]");
    expect(dealFlow).toContain("<CanonicalBottomNav locale={locale} active='/platform-v7/deal-flow'/>");
  });

  it('keeps login and registration on the same canonical public shell',()=>{
    expect(loginPage).toContain("<CanonicalPublicHeader locale={locale} activePath='/platform-v7/login'/>");
    expect(loginPage).toContain("<CanonicalBottomNav locale={locale} active='/platform-v7/login'/>");
    expect(registerPage).toContain("<CanonicalPublicHeader locale={locale} activePath='/platform-v7/register' localeControl={localeControl} />");
    expect(registerPage).toContain("<CanonicalBottomNav locale={locale} active='/platform-v7/register' />");
    expect(primitives).toContain("pc-site-mobile-utility");
    expect(primitives).toContain("Аккаунт и помощь");
  });

  it('keeps market filters functional and crop visuals explicit',()=>{
    for(const name of ["name='q'","name='crop'","name='region'","name='grade'","name='sort'"]) expect(marketPage).toContain(name);
    expect(marketPage).toContain("filters={{crop,region,grade}} sort={sort}");
    expect(marketPage).toContain("className='pc-cp-market-active-filters'");
    expect(market).toContain('filterPublicLots(market.items, context, lang)');
    expect(market).toContain('cropForCulture');
    expect(market).toContain('function CropPhoto');
    expect(market).not.toContain('function CropArt');
    expect(market).toContain('/platform-v7/crops/${crop}-640.webp');
    expect(market).toContain("loading='lazy'");
    expect(market).toContain("className='pc-cp-lot-media-caption'");
    expect(market).toContain("marketApplicationHref(lang, 'buy'");
    expect(market).toContain("marketApplicationHref(lang, 'sell'");
    expect(market).toContain("buy: 'Купить'");
    expect(market).toContain("sell: 'Продать'");
    expect(css).toContain('FINAL PUBLIC UX POLISH');
    expect(css).toContain('.pc-cp-market-filter-grid');
    expect(css).toContain('.pc-cp-market-active-filters');
    expect(siteHeader).not.toContain('.pc-site-header{height:60px;');
    expect(css).toContain('OWNER UX SYSTEM CLOSURE — 2026-09-22');
  });

  it('reserves mobile space for the fixed bottom navigation and capabilities',()=>{
    expect(capabilitiesPage).toContain("pc-cp-page-capabilities");
    expect(css).toContain("padding-bottom:calc(82px + env(safe-area-inset-bottom,0px))");
    expect(css).toContain(".pc-cp-page-home #capabilities");
    expect(css).toContain(".pc-cp-page-capabilities>.pc-cp-section:last-of-type");
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
      '四个信任支柱',
      '9 个规范角色',
      'Контекст. Аналитика. Обоснованные следующие шаги.',
      'Not a feature catalogue for its own sake',
      'Не каталог функций ради функций',
      'Один контекст, семь этапов, проверяемые факты.',
      'One context, seven stages, verifiable facts.',
      'Одна система для всей агросделки.',
      'One system for the whole agricultural Deal.',
      '一套系统管理整笔农业交易。',
      'Public lots without fabricated data',
      '公开批次，不使用虚构数据',
      'Seven stages in one context',
      '七个阶段，一个上下文',
      'One design language for every participant',
      '所有参与方使用同一套设计语言',
      'Intelligence inside context, never instead of authority',
      '智能服务于上下文，而不是取代权限',
      'One system instead of disconnected circuits',
      '一个系统，替代分散的工作链路',
      'Deal facts in one place.',
      'Больше ясности на каждом этапе Сделки',
      'More clarity at every Deal stage',
      '交易每个阶段都更清晰',
      'Помогает принять решение быстрее',
      'Helps decide faster',
      '帮助更快决策',
      'От поля до результата',
      'From field to outcome',
      '从田间到结果',
      'Правила торгов и серверно подтверждённый результат',
      'Trading rules and server-confirmed outcome',
      '交易规则和服务器确认的结果',
      'Сам факт доставки не даёт клиенту права менять финансовое состояние',
      'Delivery itself cannot let the client choose financial state',
      '交付本身不能让客户端选择金融状态',
      'Gekta AI',
      'Deal context',
      '交易上下文',
      '仅限授权上下文',
      '只读取授权上下文',
      '询问上下文、风险或下一步',
      '关键决定保持受控',
      'Доверие на каждом шаге',
      'Trust at every step',
      '每一步都建立信任',
      'Сквозная Сделка',
      'End-to-end Deal',
      '端到端交易',
      'подтверждённой серверной проекции',
      'admitted by the server for public publication',
      '服务器允许公开发布',
      '公共匿名投影',
      'Права определяются сервером после проверки роли и организации.',
      'Rights are assigned by the server after role and organisation checks.',
      '角色和机构审核完成后，由服务器确定访问权限。',
      'Публичный рынок раскрывает только разрешённую обезличенную проекцию.',
      'The public market exposes only the permitted anonymised projection.',
      '公开市场只展示获准的匿名投影。',
      'Settlement status comes from the server and changes only after confirmed events.',
      '结算状态来自服务器，只会根据已确认事件发生变化。',
      'Роль, организация и доступ определяются сервером после проверки.',
      'Role, organisation and access are assigned after server-side verification.',
      '角色、机构和访问权限在服务器完成审核后确定。',
      'Источник: публичная обезличенная проекция PostgreSQL',
      'Публичный рынок показывает только лоты, которые сервер разрешил к обезличенной публикации.',
      'Сервер не подтвердил актуальную публичную проекцию.',
      'Source: public anonymised PostgreSQL projection',
      'The public market shows only lots the server has admitted to anonymised publication.',
      'The server did not confirm a current public projection.',
      '来源：PostgreSQL 公共匿名投影',
      '公开市场仅展示服务器允许匿名公开的批次。',
      '服务器未确认当前公共投影',
      'Не опубликовано в публичном контуре',
      'Not published in the public circuit',
      'Недоступно в публичном контуре',
      'Unavailable in the public circuit',
    ]) expect(home + primitives + market + linkedCopy).not.toContain(retired);

    for(const humanCopy of [
      'Продавайте и покупайте урожай. Держите сделку под контролем.',
      'Экран сразу показывает, что произошло',
      'Sell and buy crops. Keep your Deal under control.',
      '销售与采购农产品，掌握交易进展。',
      'Помощник по Сделке',
      'Deal assistant',
      '交易助手',
      'Статус расчёта меняется только по подтверждённым событиям.',
      'Интеграция или внешнее событие считаются подтверждёнными только после фактического подтверждения внешней системой.',
      '事实、权限和决定都可核验。',
      '操作前的四项检查',
      '9 个角色',
      'Market, execution, documents, settlement and closure stay connected.',
      'На каждом этапе указаны участник, факты, основание и следующий шаг.',
      'Правила торгов и подтверждённый результат торгов',
      'Trading rules and confirmed trading result',
      '交易规则和已确认的交易结果',
      'Доставка не означает завершение расчёта: сначала нужны приёмка и документы',
      'Delivery does not complete settlement: acceptance and documents are still needed.',
      '交付不代表结算已完成，还需要验收和相关文件。',
      'Deal assistant',
      '交易助手',
      'Deal data',
      '交易数据',
      '仅限授权数据',
      '只读取授权数据',
      '询问交易、风险或下一步',
      '关键决定由人作出',
      'Проверки на каждом этапе',
      'Checks at every stage',
      '每个阶段的检查',
      'Показываются только разрешённые к публикации обезличенные лоты.',
      'Only anonymised lots permitted for public publication are shown.',
      '仅展示获准公开发布的匿名批次',
      'Этапы Сделки',
      'Deal stages',
      '交易阶段',
      'Статус расчёта меняется только по подтверждённым событиям.',
      'Settlement status changes only after confirmed events.',
      '结算状态只会根据已确认事件发生变化。',
      'Публичный рынок показывает только разрешённые обезличенные данные.',
      'The public market shows only permitted anonymised data.',
      '公开市场只展示获准公开的匿名数据。',
      'Доступ появляется только после проверки роли, организации и полномочий.',
      'Access is granted only after role, organisation and authority verification.',
      '角色、机构和权限审核通过后才会开放访问。',
      'Загружаем подтверждённые данные.',
      'Источник: обезличенные данные публичного рынка',
      'Опубликованных предложений пока нет',
      'Не удалось загрузить предложения',
      'Source: anonymised public market data',
      'No published offers yet',
      'Could not load offers',
      '来源：公开市场匿名数据',
      '暂无已发布的供求信息',
      '未能加载供求信息',
    ]) expect(home + primitives + market + linkedCopy).toContain(humanCopy);
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

  it('renders the canonical lot screen by public reference without positional fallback or private seller data',()=>{
    expect(market).toContain('CanonicalPublicLotView');
    expect(market).toContain("data-testid='canonical-public-lot-view'");
    expect(market).toContain('findPublicLot(market.items, lotRef)');
    expect(market).toContain('marketHref(locale, context, lot.publicRef)');
    expect(market).not.toContain('publicIndex');
    expect(market).not.toContain('market.items[lotIndex]');
    expect(marketSource).toContain("sellerIdentity: 'REDACTED'");
    expect(market).toContain('Фото культуры, не партии');
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
    expect(gekta).toContain('решение остаётся за человеком.');
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

  for (const sourcePath of [
    'components/platform-v7/PlatformV7StrategicHome.tsx',
    'app/platform-v7/market/page.tsx',
    'app/platform-v7/deal-flow/page.tsx',
    'app/platform-v7/about/page.tsx',
    'app/platform-v7/how-it-works/page.tsx',
    'app/platform-v7/capabilities/page.tsx',
  ]) {
    it(`${sourcePath}: every public outline is unbound to invented Deal progress`, () => {
      const calls = [...read(sourcePath).matchAll(/<CanonicalDealSpine\b[^>]*\/>/g)];
      expect(calls.length).toBeGreaterThan(0);
      for (const [call] of calls) expect(call).toContain('currentIndex={null}');
    });
  }

  it('keeps the home state explanatory and four participation actions application-only', () => {
    expect(home).toContain("presentation='explanation'");
    expect(home).toContain('state={null}');
    expect(home).not.toContain("state='normal'");
    expect(home).toContain("const GROUP_INTENTS = ['sell', 'buy', 'execution', 'finance'] as const");
    expect(home).toContain('`${registerBase}&intent=${GROUP_INTENTS[index]!}`');
    expect(home).not.toContain('tenantId');
    expect(home).not.toContain('setDirectRole');
  });

  it('keeps linked-page actions distinct and removes forced inline hero sizing', () => {
    const about = read('app/platform-v7/about/page.tsx');
    const how = read('app/platform-v7/how-it-works/page.tsx');
    expect(about).toContain('Продажа, закупка и исполнение — в одной сделке');
    expect(about).not.toContain('c.domain');
    expect(about).not.toMatch(/minHeight:\s*\d/);
    expect(capabilitiesPage).not.toMatch(/minHeight:\s*\d/);
    expect(capabilitiesPage).not.toContain("maxWidth:'14ch'");
    expect(capabilitiesPage).toContain('Всё, что нужно для работы со сделкой');
    expect(capabilitiesPage).toContain('/platform-v7?lang=${locale}#participants');
    expect(capabilitiesPage).toContain('CAPABILITIES.map');
    expect(how).toContain('От предложения до завершения сделки');
    expect(how).toContain('Рабочий экран сделки');
    expect(how).toContain('/platform-v7/deal-flow?lang=${locale}');
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

  it('keeps the default public outline neutral without using that default in a private Deal', () => {
    const result = markup(createElement(CanonicalDealSpine, { locale: 'ru' }));
    expect(result.querySelectorAll('[data-state="done"]')).toHaveLength(0);
    expect(result.querySelectorAll('[data-state="current"]')).toHaveLength(0);
    expect(result.querySelectorAll('[data-state="unknown"]')).toHaveLength(7);
    expect(result.querySelectorAll('[aria-current]')).toHaveLength(0);
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

  it('keeps public Deal state indicators informational instead of fake navigation', () => {
    const dealFlowSource = read('app/platform-v7/deal-flow/page.tsx');
    const result = markup(createElement(CanonicalStateTabs, {
      locale: 'ru',
      state: 'normal',
    }));
    expect(result.querySelectorAll('.pc-cp-state-tab')).toHaveLength(3);
    expect(result.querySelectorAll('a.pc-cp-state-tab, button.pc-cp-state-tab')).toHaveLength(0);
    expect(result.querySelector('[data-state="normal"]')?.getAttribute('aria-current')).toBe('true');
    expect(dealFlowSource).not.toContain('stateLinks={{');
    expect(dealFlowSource).not.toContain('publicState(first(params.state))');
  });

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

// Public-market fixtures remain in this unit process; no published data is created.
const publicMarketReadMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/public-market-server', () => ({ getPublicMarketLots: publicMarketReadMock }));

describe('public market identity, context and truthful states', () => {
  const A = 'market-11111111-1111-4111-8111-111111111111';
  const B = 'market-22222222-2222-4222-8222-222222222222';
  const observedAt = '2026-09-22T12:00:00Z';
  const lot = (publicRef: string, overrides: Partial<PublicMarketLot> = {}): PublicMarketLot => ({
    publicRef, culture: 'wheat', grade: '3 класс', volumeTons: '100', startPriceKopecksPerTon: '1234567890123456789', region: 'Тамбовская область', auctionEndsAt: '2026-09-23T12:00:00Z', status: 'BIDDING', verificationStatus: 'DECLARED', tradePermission: 'PUBLIC_ALLOWED', independentVerification: null, disclosureCode: 'SELLER_DECLARED_NOT_INDEPENDENTLY_VERIFIED', version: '1', ...overrides,
  });
  const result = (items: readonly PublicMarketLot[], available = true): PublicMarketReadResult => ({
    available, items: available ? items : [], error: available ? null : 'unavailable',
    authority: available ? { source: 'POSTGRESQL', scope: 'PUBLIC_MARKET', projection: 'ANONYMIZED_PUBLIC_MARKET', sellerIdentity: 'REDACTED', observedAt, version: '1' } : null,
  });
  const markup = (tree: Parameters<typeof renderToStaticMarkup>[0]) => {
    const root = document.createElement('div'); root.innerHTML = renderToStaticMarkup(tree); return root;
  };
  function elements(node: ReactNode): ReactElement<Record<string, any>>[] {
    if (Array.isArray(node)) return node.flatMap(elements);
    return isValidElement<Record<string, any>>(node) ? [node, ...elements(node.props.children)] : [];
  }
  afterEach(() => { cleanup(); publicMarketReadMock.mockReset(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it('binds one public reference across reordering and never substitutes a missing or duplicate entry', () => {
    const a = lot(A); const b = lot(B, { culture: 'barley' });
    for (const rows of [[a, b], [b, a]]) expect(findPublicLot(rows, A)).toBe(a);
    expect(findPublicLot([b], A)).toBeNull();
    expect(findPublicLot([a, { ...a }], A)).toBeNull();
    expect(findPublicLot([a], A.toUpperCase())).toBe(a);
  });
  it.each([undefined, null, '', '0', '1', '0000', '-1', A + '/extra', A + '\n', ' ' + A, [A], { publicRef: A }, 'https://external.invalid/' + A].map(value=>({value})))('rejects invalid or legacy identifier %j without a read', async ({value}) => {
    expect(publicLotReference(value)).toBeNull();
    const view = markup(await CanonicalPublicLotView({ locale: 'ru', lotRef: value }));
    expect(view.querySelector('[data-market-state="invalidLink"]')).toBeTruthy();
    expect(view.querySelectorAll('.pc-cp-lot-summary, time')).toHaveLength(0);
    expect(publicMarketReadMock).not.toHaveBeenCalled();
  });

  for (const locale of ['ru', 'en', 'zh'] as const) {
    for (const crop of PUBLIC_CROPS) {
      for (const intent of ['sell', 'buy'] as const) {
        it(`${locale} / ${crop} / ${intent}: carries selection separately from the original return filters`, async () => {
          const filters = publicMarketContext({ q: 'урожай', region: 'Тамбовская область', grade: '3 класс', sort: 'price-asc' });
          const link = new URL(marketApplicationHref(locale, intent, filters, A, crop), 'https://example.invalid');
          const params = Object.fromEntries(link.searchParams);
          expect(link.pathname).toBe('/platform-v7/register');
          expect(params).toMatchObject({ lang: locale, intent, lot: A, crop });
          const context = publicMarketRegistrationContext(params)!;
          expect(context.selectedCrop).toBe(crop);
          expect(context.filters).toEqual(filters);
          const back = new URL(marketHref(locale, context.filters), 'https://example.invalid');
          expect(Object.fromEntries(back.searchParams)).toEqual({ lang: locale, q: filters.q, region: filters.region, grade: filters.grade, sort: filters.sort });
          const tree = await RegisterPage({ searchParams: Promise.resolve({ ...params, role: 'PLATFORM_OWNER', tenantId: 'untrusted' }) });
          const all = elements(tree);
          const form = all.find(node => node.type === RegisterFormClientPublic)!;
          expect(form.props.initialWorkspace).toBe(intent === 'sell' ? 'seller' : 'buyer');
          for (const key of ['role', 'tenantId', 'lot', 'crop', 'selectedCrop', 'returnTo']) expect(form.props).not.toHaveProperty(key);
          const header = all.find(node => node.props.localeControl)!;
          const languageLinks = elements(header.props.localeControl).filter(node => node.type === 'a');
          expect(languageLinks).toHaveLength(3);
          for (const anchor of languageLinks) {
            const query = new URL(anchor.props.href, 'https://example.invalid').searchParams;
            expect(query.get('lot')).toBe(A); expect(query.get('intent')).toBe(intent); expect(query.get('crop')).toBe(crop); expect(publicMarketRegistrationContext(Object.fromEntries(query))!.filters).toEqual(filters);
            for (const key of ['role', 'tenantId']) expect(query.has(key)).toBe(false);
            expect(query.get('returnTo')).toBe(marketHref(query.get('lang') as 'ru'|'en'|'zh', filters));
          }
          const contextPanel = all.find(node => node.props['data-testid'] === 'public-application-context')!;
          expect(elements(contextPanel).find(node => node.type === 'a')!.props.href).toBe(back.pathname + back.search);
        });
      }
    }
    it(`${locale}: category cards remain useful without fabricating offers or timers`, () => {
      const view = markup(createElement(CanonicalCropCatalogue, { locale }));
      const cards = view.querySelectorAll('[data-crop-category]');
      expect(cards).toHaveLength(8);
      for (const card of cards) {
        expect(card.textContent).toContain(PUBLIC_CROP_LABELS[locale][card.getAttribute('data-crop-category') as typeof PUBLIC_CROPS[number]]);
        expect(card.querySelectorAll(`a[href^="/platform-v7/register?"]`)).toHaveLength(2);
        expect(card.querySelectorAll('time, .pc-cp-lot-meta, .pc-cp-chip')).toHaveLength(0);
        const photo=card.querySelector('img')!;
        expect(photo.getAttribute('src')).toBe(`/platform-v7/crops/${card.getAttribute('data-crop-category')}-640.webp`);
        expect(photo.getAttribute('loading')).toBe('lazy');
        expect(photo.getAttribute('width')).toBe('640');
        expect(photo.getAttribute('height')).toBe('400');
      }
      expect(view.textContent).not.toContain('Данные лота недоступны');
      expect(publicMarketReadMock).not.toHaveBeenCalled();
    });
    it(`${locale}: unavailable and empty projections each retain eight categories and one distinct message`, async () => {
      for (const [available, state] of [[true, 'empty'], [false, 'unavailable']] as const) {
        publicMarketReadMock.mockResolvedValue(result([], available));
        const view = markup(await CanonicalMarketPreview({ locale }));
        expect(view.querySelectorAll('[data-crop-category]')).toHaveLength(8);
        expect(view.querySelectorAll('[data-market-state]')).toHaveLength(1);
        expect(view.querySelector('[data-market-state]')?.getAttribute('data-market-state')).toBe(state);
        expect(view.querySelectorAll('.pc-cp-lot-card, time')).toHaveLength(0);
        expect(view.querySelector('[data-market-state] a')).toBeTruthy();
      }
    });
  }
  it('strips unsafe paths, role hints, tokens, oversized text and repeated query values', () => {
    const url = new URL(marketApplicationHref('ru', 'buy', { q: ['bad'], crop: '__proto__', grade: 'x'.repeat(81), region: 'safe\nunsafe', sort: 'evil', returnTo: '//external.invalid', role: 'bank', verify: 'secret', tenantId: 'private' }, A + 'trailing'), 'https://example.invalid');
    expect(Object.fromEntries(url.searchParams)).toEqual({ lang: 'ru', intent: 'buy', returnTo:'/platform-v7/market?lang=ru' });
    expect(() => marketApplicationHref('ru', 'owner' as 'buy')).toThrow();
    expect(publicMarketRegistrationContext({ selectedCrop: 'wheat', role: 'seller' })).toBeNull();
    expect(publicMarketLocaleHref('zh', { lot: ['0', A], q: 'grain', role: 'bank' })).toBe('/platform-v7/market?lang=zh&q=grain&lot=invalid');
  });
  it('combines all filters with sorting and keeps exact public identity in every card link', async () => {
    publicMarketReadMock.mockResolvedValue(result([lot(A), lot(B, { startPriceKopecksPerTon: '900', volumeTons: '200' }), lot('market-33333333-3333-4333-8333-333333333333', { culture: 'barley' })]));
    const view = markup(await CanonicalMarketResults({ locale: 'ru', query: 'пшеница', filters: { crop: 'wheat', region: 'тамбов', grade: '3' }, sort: 'price-asc' }));
    const titles = [...view.querySelectorAll<HTMLAnchorElement>('.pc-cp-lot-title')];
    expect(titles).toHaveLength(2);
    expect(titles.map(a => new URL(a.getAttribute('href')!, 'https://example.invalid').searchParams.get('lot'))).toEqual([B, A]);
    for (const a of titles) expect(new URL(a.getAttribute('href')!, 'https://example.invalid').searchParams.get('q')).toBe('пшеница');
    const unfiltered=markup(await CanonicalMarketResults({locale:'ru',query:'3',sort:'closing'}));
    const entry=unfiltered.querySelector<HTMLAnchorElement>('.pc-cp-lot-card a[href^="/platform-v7/register?"]')!;
    const entryQuery=new URL(entry.getAttribute('href')!,'https://example.invalid').searchParams;
    expect(entryQuery.get('crop')).toBe('wheat');
    expect(publicMarketRegistrationContext(Object.fromEntries(entryQuery))!.filters).toEqual(publicMarketContext({q:'3',sort:'closing'}));
    expect(view.textContent).toContain('12 345 678 901 234 567,89 ₽/т');
    const miss = markup(await CanonicalMarketResults({ locale: 'ru', filters: { crop: 'oats' } }));
    expect(miss.querySelector('[data-market-state="noMatch"]')).toBeTruthy();
    expect(miss.querySelector('a')?.getAttribute('href')).toBe('/platform-v7/market?lang=ru');
  });
  it('renders only the requested published offer after reordering and shows missing after removal', async () => {
    const a=lot(A); const b=lot(B,{culture:'barley'});
    for (const items of [[a,b],[b,a],[b]]) {
      publicMarketReadMock.mockResolvedValue(result(items));
      const view=markup(await CanonicalPublicLotView({locale:'ru',lotRef:A,context:publicMarketContext({q:'зерно',sort:'closing'})}));
      if(items.includes(a)) {
        expect(view.querySelector('h1')?.textContent).toContain('Пшеница');
        expect(view.querySelector('h1')?.textContent).not.toContain('Ячмень');
        expect(view.querySelector('.pc-cp-lot-breadcrumb a:last-of-type')?.getAttribute('href')).toBe('/platform-v7/market?lang=ru&q=%D0%B7%D0%B5%D1%80%D0%BD%D0%BE&sort=closing');
      } else expect(view.querySelector('[data-market-state="notPublished"]')).toBeTruthy();
    }
  });
  it('updates a deadline to expiry without negative values or an invented auction status', () => {
    vi.useFakeTimers(); let now=0;
    vi.spyOn(performance,'now').mockImplementation(()=>now);
    vi.spyOn(document,'hidden','get').mockReturnValue(false);
    const view=render(createElement(PublicMarketDeadline,{endsAt:'2026-09-22T12:00:02Z',initialNow:Date.parse(observedAt),locale:'ru'}));
    expect(view.container.textContent).toBe('00:01');
    act(()=>{now=1000;vi.advanceTimersByTime(1000);});
    expect(view.container.textContent).toBe('00:01');
    act(()=>{now=3000;vi.advanceTimersByTime(2000);});
    expect(view.container.textContent).toBe('Время вышло');
    expect(view.container.querySelector('time')?.dateTime).toBe('2026-09-22T12:00:02Z');
    expect(view.container.querySelector('[data-state]')).toBeNull();
    view.unmount(); expect(vi.getTimerCount()).toBe(0);
  });
});


describe('public registration truthful outcomes', () => {
  it('preserves the same idempotency key only for the exact unknown payload', () => {
    let sequence = 0;
    const makeKey = () => `key-${++sequence}`;
    const first = registrationOperationForPayload('{"email":"a@example.test"}', null, makeKey);
    const retry = registrationOperationForPayload('{"email":"a@example.test"}', first, makeKey);
    const changed = registrationOperationForPayload('{"email":"b@example.test"}', first, makeKey);
    expect(retry).toBe(first);
    expect(retry.idempotencyKey).toBe('key-1');
    expect(changed.idempotencyKey).toBe('key-2');
  });

  it('classifies accepted, confirmed invalid, unavailable and indeterminate mutation results without inventing success', () => {
    expect(classifyRegistrationSubmitResponse({ ok: true, status: 202 }, { accepted: true })).toBe('accepted');
    expect(classifyRegistrationSubmitResponse({ ok: false, status: 400 }, { accepted: false })).toBe('invalid');
    expect(classifyRegistrationSubmitResponse({ ok: false, status: 503 }, { accepted: false })).toBe('unknown');
    expect(classifyRegistrationSubmitResponse({ ok: false, status: 503 }, { outcome: 'unknown' })).toBe('unknown');
    expect(classifyRegistrationSubmitResponse({ ok: false, status: 503 }, { outcome: 'unknown', code: 'REGISTRATION_EMAIL_DELIVERY_UNAVAILABLE' })).toBe('unknown');
    expect(classifyRegistrationSubmitResponse({ ok: false, status: 503 }, { outcome: 'unknown', code: 'REGISTRATION_DELIVERY_CONTRACT_UNKNOWN' })).toBe('unknown');
    expect(classifyRegistrationSubmitResponse({ ok: false, status: 409 }, { accepted: false })).toBe('unknown');
    expect(classifyRegistrationSubmitResponse({ ok: false, status: 429 }, { accepted: false })).toBe('unavailable');
    expect(classifyRegistrationSubmitResponse({ ok: true, status: 200 }, {})).toBe('unknown');
    expect(classifyRegistrationSubmitResponse({ ok: false, status: 503 }, null)).toBe('unknown');
  });

  it('accepts business status only when both server status and next action are allowlisted', () => {
    expect(parseRegistrationStatusSnapshot({
      ok: true,
      applicationId: 'APP-1',
      status: 'ORGANIZATION_VERIFICATION_PENDING',
      nextAction: 'WAIT_FOR_REVIEW',
      reason: null,
    })).toMatchObject({
      applicationId: 'APP-1',
      status: 'ORGANIZATION_VERIFICATION_PENDING',
      nextAction: 'WAIT_FOR_REVIEW',
    });
    expect(parseRegistrationStatusSnapshot({ ok: true, status: 'APPROVED', nextAction: 'FORGED_ACTION' })).toBeNull();
    expect(parseRegistrationStatusSnapshot({ ok: true, status: 'FORGED_STATUS', nextAction: 'WAIT' })).toBeNull();
    expect(parseRegistrationStatusSnapshot({ ok: true, status: 'APPROVED' })).toBeNull();
  });

  it('keeps invalid/unavailable transport truth separate from business status', () => {
    expect(classifyRegistrationStatusResponse({ ok: false, status: 404 }, { ok: false, code: 'REGISTRATION_APPLICATION_NOT_FOUND' })).toEqual({ kind: 'invalid' });
    expect(classifyRegistrationStatusResponse({ ok: false, status: 503 }, { ok: false, code: 'REGISTRATION_SERVICE_UNAVAILABLE' })).toEqual({ kind: 'unavailable' });
    expect(classifyRegistrationStatusResponse({ ok: true, status: 200 }, { ok: true, status: 'APPROVED' })).toEqual({ kind: 'unavailable' });
    expect(classifyRegistrationStatusResponse({ ok: true, status: 200 }, {
      ok: true, status: 'ACTIVATED', nextAction: 'LOGIN',
    })).toMatchObject({ kind: 'available', status: { status: 'ACTIVATED', nextAction: 'LOGIN' } });
  });

  it('does not retain the old VERIFY_EMAIL fallback in either public registration component', () => {
    const publicForm = read('app/platform-v7/register/RegisterFormClientPublic.tsx');
    const localizedForm = read('app/platform-v7/register/RegisterFormClient.tsx');
    for (const source of [publicForm, localizedForm]) {
      expect(source).not.toContain("status?.status || 'EMAIL_VERIFICATION_REQUIRED'");
      expect(source).not.toContain("status?.nextAction || 'VERIFY_EMAIL'");
      expect(source).toContain("statusReadState !== 'available'");
      expect(source).toContain('registrationOperationForPayload(');
      expect(source).toContain('submitLockRef.current = true');
    }
  });

  it('marks only transport loss as an unknown BFF result instead of saying it was rejected', () => {
    const bff = read('app/api/auth/register/route.ts');
    expect(bff).toContain("outcome: 'unknown'");
    expect(bff).toContain("code: 'REGISTRATION_RESULT_UNKNOWN'");
    expect(bff).toContain("code: 'REGISTRATION_DELIVERY_CONTRACT_UNKNOWN'");
    expect(bff).toContain("code: 'REGISTRATION_EMAIL_DELIVERY_UNAVAILABLE'");
    expect(bff).toContain("if (!apiResponse.ok || payload.accepted !== true)");
  });
});
