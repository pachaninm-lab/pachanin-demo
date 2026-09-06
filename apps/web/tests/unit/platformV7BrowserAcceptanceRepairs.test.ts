import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const serverLayout = read('apps/web/app/platform-v7/layout.tsx');
const guard = read('apps/web/components/platform-v7/PlatformV7SingleEntryGuard.tsx');
const protectedRuntime = read('apps/web/components/platform-v7/PlatformV7ProtectedRuntime.tsx');
const protectedShell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');
const protectedShellCss = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.module.css');
const designSystemRuntime = read('apps/web/components/platform-v7/PlatformV7DesignSystemV8Runtime.tsx');
const publicHeader = read('apps/web/components/platform-v7/PublicSiteHeader.tsx');
const contactHeader = read('apps/web/components/platform-v7/ContactFixedHeader.tsx');
const publicHomeCompatCss = read('apps/web/styles/platform-v7-international-home-fix.css');
const publicRoleScenarioCss = read('apps/web/components/platform-v7/PublicDealRoleScenario.module.css');
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

  it('keeps one canonical 64px public header authority without wrapping on phones', () => {
    expect(publicHeader).toContain("data-public-site-header='canonical'");
    expect(publicHeader).toContain('flex-wrap: nowrap !important;');
    expect(publicHeader).toContain('height: 64px !important;');
    expect(publicHeader).toContain('--entry-public-header-base: 64px !important;');
    expect(publicHeader).toContain(".pc-site-header[data-public-site-header='canonical'] .pc-site-brand-text");
    expect(publicHomeCompatCss).not.toContain('--entry-public-header-base: 96px');
    expect(publicHomeCompatCss).not.toContain('flex-wrap: wrap !important;');
  });

  it('keeps public anchors and section typography bound to the canonical header', () => {
    expect(publicHomeCompatCss).toContain('scroll-margin-top: calc(var(--pc-public-header-total-height, 64px) + 18px) !important;');
    expect(publicHomeCompatCss).toContain('font-size: clamp(38px, 3.3vw, 44px) !important;');
  });

  it('keeps locale-native contact brand-home accessibility copy in the shared header', () => {
    expect(contactHeader).toContain("brandHome: 'Прозрачная Цена — на главную'");
    expect(contactHeader).toContain("brandHome: 'Transparent Price — home'");
    expect(contactHeader).toContain("brandHome: '透明价格 — 返回首页'");
    expect(contactHeader).toContain('brandHomeLabel={copy.brandHome}');
    expect(contactHeader).not.toContain(':has(.p7-contact-register)');
  });

  it('uses readable single-column role detail cards at 390 and 430 mobile widths', () => {
    expect(publicRoleScenarioCss).toContain('@media (max-width: 430px)');
    expect(publicRoleScenarioCss).toMatch(/\.actionGrid,\s*\n\s*\.contextRow \{\s*\n\s*grid-template-columns: 1fr;/u);
    expect(publicRoleScenarioCss).toContain('overflow-wrap: normal;');
    expect(publicRoleScenarioCss).toContain('word-break: normal;');
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
