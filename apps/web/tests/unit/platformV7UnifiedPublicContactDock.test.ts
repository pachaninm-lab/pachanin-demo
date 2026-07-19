import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const contextual = read('apps/web/components/platform-v7/ContextualSupportOrAssistant.tsx');
const publicDock = read('apps/web/components/platform-v7/PublicContactDock.tsx');
const cabinetDock = read('apps/web/components/platform-v7/CabinetContactDock.tsx');
const policy = read('apps/web/lib/platform-v7/cabinet-contact-dock-policy.ts');
const privateAssistant = read('apps/web/components/platform-v7/AiAssistantPanel.tsx');
const protectedRuntime = read('apps/web/components/platform-v7/PlatformV7ProtectedRuntime.tsx');
const designSystemRuntime = read('apps/web/components/platform-v7/PlatformV7DesignSystemV8Runtime.tsx');
const publicLayout = read('apps/web/app/platform-v7/layout.tsx');
const publicEntryLayout = read('apps/web/app/pc-public-entry/platform-v7/layout.tsx');
const publicHeader = read('apps/web/components/platform-v7/PublicSiteHeader.tsx');

const roles = [
  'operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor',
  'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive',
] as const;

describe('platform-v7 unified public and cabinet contact docks', () => {
  it('keeps the public three-action surface unchanged', () => {
    expect(contextual).toContain("import { PublicContactDock } from './PublicContactDock'");
    expect(contextual).toContain('<PublicPlatformAssistant />');
    expect(contextual).toContain('<ChatSupportWidget />');
    expect(contextual).toContain('{renderDock ? <PublicContactDock /> : null}');
    expect(publicDock).toContain("assistant: 'ИИ'");
    expect(publicDock).toContain("support: 'Поддержка'");
    expect(publicDock).toContain("call: 'Позвонить'");
    expect(publicDock).toContain('href={SUPPORT_PHONE_HREF}');
  });

  it('uses the browser-visible path and canonicalizes every public home alias', () => {
    expect(contextual).toContain("const PUBLIC_ENTRY_REWRITE_PREFIX = '/pc-public-entry'");
    expect(contextual).toContain("if (!clean || clean === '/') return PUBLIC_HOME");
    expect(contextual).toContain('const rewrittenHome = `${PUBLIC_ENTRY_REWRITE_PREFIX}${PUBLIC_HOME}`');
    expect(contextual).toContain('return clean.slice(PUBLIC_ENTRY_REWRITE_PREFIX.length) || PUBLIC_HOME');
    expect(contextual).toContain("const browserPathname = typeof window === 'undefined' ? routerPathname : window.location.pathname");
  });

  it('mounts one verified-role cabinet dock before the deferred assistant runtime', () => {
    expect(protectedRuntime).toContain("import { CabinetContactDock } from '@/components/platform-v7/CabinetContactDock'");
    expect(protectedRuntime).toContain('<CabinetContactDock role={verifiedRole} assistantContext={assistantContext} />');
    expect(protectedRuntime).toContain('<HydrationSafeChatSupport verifiedRole={verifiedRole} renderDock={false} />');
    expect(protectedRuntime.indexOf('<CabinetContactDock'))
      .toBeLessThan(protectedRuntime.indexOf('<HydrationSafeChatSupport'));
    expect(designSystemRuntime).not.toContain('<HydrationSafeChatSupport />');
  });

  it('keeps a safe fallback dock contract in the contextual runtime without duplicates', () => {
    expect(contextual).toContain('verifiedRole?: PlatformRole');
    expect(contextual).toContain('renderDock?: boolean');
    expect(contextual).toContain("<CabinetContactDock role={verifiedRole} assistantContext='private' />");
    expect(contextual).toContain("<CabinetContactDock role={verifiedRole} assistantContext='workspace' />");
    expect(contextual).toContain('renderDock && verifiedRole');
    expect(publicEntryLayout).toContain('<HydrationSafeChatSupport renderDock={false} />');
  });

  it('covers every cabinet role with a localized focus and support domain', () => {
    expect(policy).toContain('export const ALL_CABINET_ROLES');
    for (const role of roles) expect(policy).toContain(`${role}:`);
    expect(policy).toContain("ru: {");
    expect(policy).toContain("en: {");
    expect(policy).toContain("zh: {");
    expect(policy).toContain("supportTopic: 'payments'");
    expect(policy).toContain("supportTopic: 'dispute'");
    expect(policy).toContain("supportTopic: 'documents'");
  });

  it('binds the dock to the server-verified role instead of route or client storage', () => {
    expect(cabinetDock).toContain('role: PlatformRole');
    expect(cabinetDock).toContain('getCabinetContactDockPolicy(role, locale)');
    expect(cabinetDock).toContain('data-cabinet-role={role}');
    expect(cabinetDock).not.toContain('localStorage');
    expect(cabinetDock).not.toContain('sessionStorage');
    expect(cabinetDock).not.toContain('pc-role');
    expect(protectedRuntime).toContain('verifiedRole: PlatformRole');
  });

  it('routes AI to the correct private or full-page assistant', () => {
    expect(cabinetDock).toContain("type AssistantContext = 'private' | 'workspace'");
    expect(cabinetDock).toContain("? '#p7-private-ai-assistant-workspace'");
    expect(cabinetDock).toContain(": '#p7-private-ai-assistant-panel'");
    expect(cabinetDock).toContain("const assistantTriggerSelector = assistantContext === 'workspace' ? null : '.p7-ai-trigger'");
    expect(cabinetDock).toContain("workspace.scrollIntoView({ block: 'start', behavior: 'smooth' })");
    expect(privateAssistant).toContain("id={variant === 'floating' ? 'p7-private-ai-assistant-panel' : 'p7-private-ai-assistant-workspace'}");
  });

  it('hides late-mounted internal launchers and restores focus safely', () => {
    expect(cabinetDock).toContain('const hiddenTriggers = new Map<HTMLButtonElement, HiddenTriggerState>()');
    expect(cabinetDock).toContain("node.setAttribute('tabindex', '-1')");
    expect(cabinetDock).toContain("node.setAttribute('aria-hidden', 'true')");
    expect(cabinetDock).toContain('const observer = new MutationObserver(sync)');
    expect(cabinetDock).toContain('assistantButtonRef.current?.focus()');
    expect(cabinetDock).toContain('supportButtonRef.current?.focus()');
  });

  it('stays above cabinet navigation and adapts operator, review and field contours', () => {
    expect(cabinetDock).toContain("data-role-tone={policy.tone}");
    expect(cabinetDock).toContain("data-shell-family={policy.shellFamily}");
    expect(cabinetDock).toContain("data-role-tone='review'");
    expect(cabinetDock).toContain("data-role-tone='field'");
    expect(cabinetDock).toContain("data-shell-family='operator'");
    expect(cabinetDock).toContain('bottom: max(94px, calc(env(safe-area-inset-bottom, 0px) + 90px))');
    expect(cabinetDock).toContain('bottom: max(100px, calc(env(safe-area-inset-bottom, 0px) + 96px))');
    expect(cabinetDock).toContain('z-index: 97');
    expect(cabinetDock).toContain('.pc-shell-root-v4 .pc-v4-main');
  });

  it('uses role-aware visible copy, analytics and the explicit call action', () => {
    expect(cabinetDock).toContain('<small>{policy.roleLabel}</small>');
    expect(cabinetDock).toContain('<small>{policy.supportDomain}</small>');
    expect(cabinetDock).toContain('data-support-topic={policy.supportTopic}');
    expect(cabinetDock).toContain("trackEvent('cabinet_contact_dock_action'");
    expect(cabinetDock).toContain('cabinetRole: role');
    expect(cabinetDock).toContain('pagePath: routePath');
    expect(cabinetDock).toContain("const SUPPORT_PHONE_HREF = 'tel:+79162778989'");
    expect(cabinetDock).toContain('href={SUPPORT_PHONE_HREF}');
  });

  it('does not overlay open dialogs and remains accessible on mobile', () => {
    expect(cabinetDock).toContain("document.querySelector('[role=\"dialog\"][aria-modal=\"true\"]')");
    expect(cabinetDock).toContain("data-dialog-open={dialogOpen ? 'true' : 'false'}");
    expect(cabinetDock).toContain(".pc-cabinet-contact-dock[data-dialog-open='true']");
    expect(cabinetDock).toContain('visibility: hidden');
    expect(cabinetDock).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(cabinetDock).toContain('env(safe-area-inset-bottom');
    expect(cabinetDock).toContain('@media (prefers-reduced-motion: reduce)');
    expect(cabinetDock).toContain('@media (forced-colors: active)');
  });

  it('mounts public docks at route boundaries rather than individual headers', () => {
    expect(publicLayout).toContain('if (isPublicPath(pathname)) {');
    expect(publicLayout).toContain('<HydrationSafeChatSupport />');
    expect(publicEntryLayout).toContain('<PublicContactDock />');
    expect(publicHeader).not.toContain('<HydrationSafeChatSupport />');
  });
});
