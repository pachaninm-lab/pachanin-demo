import assert from 'node:assert/strict';
import { filterPublicLots, publicMarketContext, type PublicSortableLot } from '@/lib/platform-v7/public-market-navigation';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicHeroMedia } from '@/components/platform-v7/PublicHeroMedia';

const root = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const serverLayout = read('apps/web/app/platform-v7/layout.tsx');
const guard = read('apps/web/components/platform-v7/PlatformV7SingleEntryGuard.tsx');
const protectedRuntime = read('apps/web/components/platform-v7/PlatformV7ProtectedRuntime.tsx');
const protectedShell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');
const protectedShellCss = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.module.css');
const designSystemRuntime = read('apps/web/components/platform-v7/PlatformV7DesignSystemV8Runtime.tsx');
const publicHeader = read('apps/web/components/platform-v7/PublicSiteHeader.tsx');
const publicEntryLayout = read('apps/web/app/pc-public-entry/platform-v7/layout.tsx');
const supportMount = read('apps/web/components/platform-v7/HydrationSafeChatSupport.tsx');
const quietLayer = read('apps/web/components/platform-v7/UxFinalQuietLayer.tsx');
const workStepGuide = read('apps/web/components/platform-v7/WorkStepGuide.tsx');
const workStepGuideCss = read('apps/web/components/platform-v7/WorkStepGuide.module.css');
const headerCss = read('apps/web/app/platform-v7/_styles/public-header-accessibility.css');
const rootLayout = read('apps/web/app/layout.tsx');
const languageSwitch = read('apps/web/components/platform-v7/HeaderLanguageSwitch.tsx');
const platformFooter = read('apps/web/components/platform-v7/PlatformFooter.tsx');
const tokenCss = read('packages/design-tokens/tokens.css');
const tokenJson = read('packages/design-tokens/tokens.json');

describe('platform-v7 browser acceptance repairs', () => {
  it('keeps protected route authority exclusively in the verified server layout', () => {
    // The layout moved from reading a role to reading the whole verified
    // context - role plus user, membership, organization, tenant and ownerAccess
    // - which is more than this pinned, not less. Both helpers verify the same
    // signed session, so the contract is that the role comes from one of them
    // and never from anything the client can set.
    expect(serverLayout).toMatch(/readVerifiedCabinetSession(?:Role|Context)/u);
    expect(serverLayout).not.toContain("cookies().get('pc-role')");
    expect(serverLayout).toContain('canRoleAccessCabinet(role, pathname)');
    expect(guard).toContain('return null');
    for (const forbidden of [
      'useRouter',
      'usePathname',
      'sessionStorage.getItem',
      'router.replace',
      'roleAllows(',
    ]) expect(guard).not.toContain(forbidden);
  });

  it('keeps the verified protected shell server-rendered without client loading replacement', () => {
    expect(protectedRuntime).toContain('<ToastProvider>');
    expect(protectedRuntime).toContain('<PlatformThemeSync />');
    expect(protectedRuntime).toContain('<PlatformV7ProtectedShell pathname={pathname} verifiedRole={verifiedRole}>');
    expect(protectedRuntime).not.toContain('data-protected-shell-hydration');
    expect(protectedRuntime).not.toContain('setHydrated');
    expect(protectedShell).toContain(': <RoleIntentDashboard role={verifiedRole} />');
    expect(protectedShell).not.toContain('cabinetLoading');
    expect(protectedShell).not.toContain('Открываем интерфейс кабинета');
  });

  it('keeps support outside server rendering and mounts it once per public or protected tree', () => {
    expect(serverLayout).toContain('<HydrationSafeChatSupport />');
    // Mounted with the dock suppressed on the public entry tree; the assertion
    // is that support is mounted there exactly once, not that it takes no props.
    expect(publicEntryLayout).toContain('<HydrationSafeChatSupport');
    expect(publicEntryLayout.match(/<HydrationSafeChatSupport/gu)).toHaveLength(1);
    expect(publicHeader).not.toContain('<HydrationSafeChatSupport />');
    expect(publicHeader).not.toContain('<ChatSupportWidget />');
    // Mounted with the verified role and the dock suppressed, so the tag now
    // carries props. Once per tree is the property; taking no props never was.
    expect(protectedRuntime).toContain('<HydrationSafeChatSupport');
    expect(protectedRuntime.match(/<HydrationSafeChatSupport/gu)).toHaveLength(1);
    expect(designSystemRuntime).not.toContain('<HydrationSafeChatSupport />');
    expect(designSystemRuntime).not.toContain('<ChatSupportWidget />');
    expect(supportMount).toContain("import dynamic from 'next/dynamic'");
    expect(supportMount).toContain("import('@/components/platform-v7/ContextualSupportOrAssistant')");
    expect(supportMount).toContain('ssr: false');
    expect(supportMount).toContain('loading: () => null');
    expect(supportMount).not.toContain('setMounted');
    expect(supportMount).not.toContain('React.useEffect');
  });

  it('loads final quiet UX rules from the governed shell stylesheet instead of hydration text', () => {
    expect(quietLayer).toContain('return null');
    expect(quietLayer).not.toContain('<style');
    expect(quietLayer).not.toContain('dangerouslySetInnerHTML');
    expect(quietLayer).not.toContain('UxFinalQuietLayer.module.css');
    expect(protectedShellCss).toContain("[data-testid^='role-execution-summary-']");
    expect(protectedShellCss).toContain("[aria-label='Логика работы']");
    expect(protectedShellCss).toContain('@media (max-width: 640px)');
  });

  it('keeps work-step responsive rules out of hydration text', () => {
    expect(workStepGuide).toContain("from './WorkStepGuide.module.css'");
    expect(workStepGuide).not.toContain('<style');
    expect(workStepGuide).not.toContain('dangerouslySetInnerHTML');
    expect(workStepGuideCss).toContain('@media (max-width: 760px)');
    expect(workStepGuideCss).toContain('.row a');
  });

  it('reserves independent public header tracks and WCAG-sized controls', () => {
    expect(rootLayout).toContain("import './platform-v7/_styles/public-header-accessibility.css'");
    expect(headerCss).toContain('grid-template-columns: auto minmax(0, 1fr) auto');
    expect(headerCss).toContain('.pc-site-header .pc-site-nav > a');
    expect(headerCss).toContain('min-height: 44px');
    expect(headerCss).toContain('padding-inline: 6px');
    expect(headerCss).toContain('.pc-site-header .pc-site-locale-switch');
    expect(headerCss).toContain('min-width: 56px');
  });

  it('keeps Design System muted text and partner branding above WCAG AA contrast', () => {
    expect(tokenCss).toContain('--ds-color-text-muted: #5f6e67;');
    expect(tokenJson).toContain('"500": { "$value": "#5f6e67" }');
    expect(platformFooter).toContain("label: 'СберБизнес'");
    expect(platformFooter).toContain("color: '#087A3B'");
    expect(platformFooter).not.toContain("color: '#21A038'");
  });

  it('anchors the protected language control to the semantic header action rail', () => {
    expect(languageSwitch).toContain('.pc-shell-root-v4 a[aria-label="Открыть уведомления"]');
    expect(languageSwitch).toContain('protectedNotification?.parentElement');
    expect(languageSwitch).toContain("if (!target && document.querySelector('.pc-shell-root-v4')) return null");
  });

  it('switches protected locale through a server reload without mutating streamed text nodes', () => {
    expect(languageSwitch).toContain("url.searchParams.set('lang', language)");
    expect(languageSwitch).toContain('window.location.replace(url.toString())');
    expect(languageSwitch).not.toContain('applyTranslationToDom');
    expect(languageSwitch).not.toContain('startTranslationObserver');
    expect(languageSwitch).not.toContain('MutationObserver(() => apply');
  });
});

// Keep these regressions in the suite already executed by the canonical CI.
describe('public hero critical-path image', () => {
  it('embeds exactly the approved SVG bytes, not a replacement visual', () => {
    const markup = renderToStaticMarkup(createElement(PublicHeroMedia));
    const source = markup.match(/src="([^"]+)"/)?.[1];
    expect(source).toBeDefined();
    const prefix = 'data:image/svg+xml,';
    expect(source!.startsWith(prefix)).toBe(true);
    expect(decodeURIComponent(source!.slice(prefix.length))).toBe(
      read('apps/web/public/platform-v7/hero-agro-infrastructure.svg'),
    );
    expect(markup).not.toContain('<link');
    expect(markup).not.toContain('<script');
  });

  it('keeps the existing image, crop hook, dimensions and eager rendering contract', () => {
    const markup = renderToStaticMarkup(createElement(PublicHeroMedia));
    expect(markup.match(/<img\b/g)).toHaveLength(1);
    for (const attribute of [
      'class="pc-cp-hero-media"', 'alt=""', 'width="400"', 'height="320"',
      'loading="eager"', 'decoding="sync"', 'fetchpriority="high"', 'aria-hidden="true"',
    ]) expect(markup.toLowerCase()).toContain(attribute);
  });

  it('uses the inline server image without retaining an unused external preload', () => {
    const home = read('apps/web/components/platform-v7/PlatformV7StrategicHome.tsx');
    expect(home).toContain("import { PublicHeroMedia } from './PublicHeroMedia'");
    expect(home).toContain('<PublicHeroMedia />');
    expect(home).not.toContain("src='/platform-v7/hero-agro-infrastructure.svg'");
    expect(read('apps/web/app/layout.tsx')).not.toContain("href='/platform-v7/hero-agro-infrastructure.svg'");
    const component = read('apps/web/components/platform-v7/PublicHeroMedia.tsx');
    expect(component).not.toContain("'use client'");
    expect(component).not.toMatch(/fetch\(|readFile|useEffect|setTimeout|requestIdleCallback/);
  });
});

// UX-09 / T11: synthetic public offers only; no API or business-system writes.
describe('public market token search', () => {
  const wheat: PublicSortableLot = Object.freeze({
    publicRef: 'market-11111111-1111-4111-8111-111111111111',
    culture: 'Пшеница', grade: '3 класс', region: 'Тамбовская область',
    auctionEndsAt: '2026-10-01T00:00:00Z',
    startPriceKopecksPerTon: '9007199254740993', volumeTons: '10.000001',
  });
  const barley: PublicSortableLot = Object.freeze({
    ...wheat, publicRef: 'market-22222222-2222-4222-8222-222222222222',
    culture: 'Ячмень', region: 'Воронежская область',
  });
  const lots = Object.freeze([wheat, barley]);

  for (const locale of ['ru', 'en', 'zh'] as const) {
    it(`matches every query token across public fields in ${locale}`, () => {
      for (const q of ['пшеница', 'пшеница Тамбов', 'wheat Тамбов 3', '小麦 Тамбов класс']) {
        assert.deepEqual(filterPublicLots(lots, publicMarketContext({ q }), locale), [wheat]);
      }
      assert.deepEqual(filterPublicLots(lots, publicMarketContext({ q: 'пшеница Воронеж' }), locale), []);
      assert.deepEqual(filterPublicLots(lots, publicMarketContext({ q: 'пшеница nonexistent' }), locale), []);
    });

    it(`normalizes case and accepted whitespace without dropping repeated terms in ${locale}`, () => {
      for (const q of ['  ПШЕНИЦА   ТАМБОВ  ', 'WHEAT\u00a0\u00a0ТАМБОВ', '小麦\u3000Тамбов', 'wheat wheat Тамбов']) {
        assert.deepEqual(filterPublicLots(lots, publicMarketContext({ q }), locale), [wheat]);
      }
      assert.deepEqual(filterPublicLots(lots, publicMarketContext({ q: '   ' }), locale), lots);
    });
  }

  it('keeps unspaced CJK substring search and permits spaced cross-field CJK queries', () => {
    const chinese = { ...wheat, culture: '小麦', grade: '三级', region: '黑龙江省' };
    for (const q of ['黑龙江', '小麦', '小麦 黑龙江 三']) {
      assert.deepEqual(filterPublicLots([chinese], publicMarketContext({ q }), 'zh'), [chinese]);
    }
    assert.deepEqual(filterPublicLots([chinese], publicMarketContext({ q: '小麦 玉米' }), 'zh'), []);
  });

  it('allows several tokens in one public field but never merges text across field boundaries', () => {
    assert.deepEqual(filterPublicLots(lots, publicMarketContext({ q: 'Тамбовская область' }), 'ru'), [wheat]);
    assert.deepEqual(filterPublicLots(lots, publicMarketContext({ q: 'wheatтамбов' }), 'ru'), []);
  });

  it('never searches seller, tenant, public identity, money or other non-searchable fields', () => {
    const decorated = { ...wheat, sellerName: 'HiddenSeller', tenantId: 'HiddenTenant' };
    for (const q of ['HiddenSeller', 'HiddenTenant', wheat.publicRef, wheat.startPriceKopecksPerTon, '2026-10-01']) {
      assert.deepEqual(filterPublicLots([decorated], publicMarketContext({ q }), 'en'), []);
    }
  });

  it('combines token search with each existing explicit filter', () => {
    const context = { q: 'wheat Тамбов', crop: 'wheat', region: 'ТАМБОВ', grade: '3' };
    assert.deepEqual(filterPublicLots(lots, publicMarketContext(context), 'en'), [wheat]);
    for (const mismatch of [{ crop: 'barley' }, { region: 'Воронеж' }, { grade: '4' }]) {
      assert.deepEqual(filterPublicLots(lots, publicMarketContext({ ...context, ...mismatch }), 'en'), []);
    }
  });

  it('preserves exact price sorting beyond Number precision and places unavailable prices last', () => {
    const cheaper = { ...wheat, publicRef: barley.publicRef, startPriceKopecksPerTon: '9007199254740992' };
    const unavailable = { ...wheat, publicRef: 'market-33333333-3333-4333-8333-333333333333', startPriceKopecksPerTon: 'unknown' };
    const offers = Object.freeze([wheat, unavailable, cheaper]);
    assert.deepEqual(filterPublicLots(offers, publicMarketContext({ q: 'wheat Тамбов', sort: 'price-asc' }), 'en'), [cheaper, wheat, unavailable]);
    assert.deepEqual(filterPublicLots(offers, publicMarketContext({ q: 'wheat Тамбов', sort: 'price-desc' }), 'en'), [wheat, cheaper, unavailable]);
    assert.deepEqual(offers, [wheat, unavailable, cheaper]);
  });

  it('preserves exact volume and closing-time sorting after token search', () => {
    const larger = { ...wheat, publicRef: barley.publicRef, volumeTons: '10.000002', auctionEndsAt: '2026-09-30T00:00:00Z' };
    const offers = Object.freeze([wheat, larger]);
    for (const sort of ['volume-desc', 'closing']) {
      assert.deepEqual(filterPublicLots(offers, publicMarketContext({ q: 'wheat Тамбов', sort }), 'ru'), [larger, wheat]);
    }
    assert.deepEqual(offers, [wheat, larger]);
  });

  it('preserves the existing query boundary instead of silently truncating search terms', () => {
    assert.equal(publicMarketContext({ q: 'x'.repeat(121) }).q, '');
    assert.equal(publicMarketContext({ q: ['wheat', 'barley'] }).q, '');
    assert.equal(publicMarketContext({ q: 'wheat\nТамбов' }).q, '');
    assert.equal(publicMarketContext({ q: 'wheat\u0000Тамбов' }).q, '');
    const manyTerms = { ...wheat, region: 'aa bb cc dd ee ff gg hh ii' };
    const q = 'wheat aa bb cc dd ee ff gg hh ii';
    assert.deepEqual(filterPublicLots([manyTerms], publicMarketContext({ q }), 'en'), [manyTerms]);
    assert.deepEqual(filterPublicLots([manyTerms], publicMarketContext({ q: `${q} missing` }), 'en'), []);
  });

  it('retains original record identity and input order when sorting is not requested', () => {
    const noGrade = { ...wheat, publicRef: barley.publicRef, grade: null };
    const offers = Object.freeze([noGrade, wheat]);
    const selected = filterPublicLots(offers, publicMarketContext({ q: 'wheat Тамбов' }), 'ru');
    assert.equal(selected[0], noGrade);
    assert.equal(selected[1], wheat);
    assert.deepEqual(filterPublicLots([], publicMarketContext({ q: 'wheat Тамбов' }), 'ru'), []);
  });
});
