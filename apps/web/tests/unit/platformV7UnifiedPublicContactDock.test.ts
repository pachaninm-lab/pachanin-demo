import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const contextual = read('apps/web/components/platform-v7/ContextualSupportOrAssistant.tsx');
const dock = read('apps/web/components/platform-v7/PublicContactDock.tsx');
const privateAssistant = read('apps/web/components/platform-v7/AiAssistantPanel.tsx');
const protectedRuntime = read('apps/web/components/platform-v7/PlatformV7ProtectedRuntime.tsx');
const designSystemRuntime = read('apps/web/components/platform-v7/PlatformV7DesignSystemV8Runtime.tsx');
const publicLayout = read('apps/web/app/platform-v7/layout.tsx');
const publicEntryLayout = read('apps/web/app/pc-public-entry/platform-v7/layout.tsx');
const publicHeader = read('apps/web/components/platform-v7/PublicSiteHeader.tsx');

describe('platform-v7 unified public contact dock', () => {
  it('replaces the two public launchers with one three-action surface', () => {
    expect(contextual).toContain("import { PublicContactDock } from './PublicContactDock'");
    expect(contextual).toContain('<PublicPlatformAssistant />');
    expect(contextual).toContain('<ChatSupportWidget />');
    expect(contextual).toContain('<PublicContactDock />');
    expect(dock).toContain("assistant: 'ИИ'");
    expect(dock).toContain("support: 'Поддержка'");
    expect(dock).toContain("call: 'Позвонить'");
    expect(dock).toContain('href={SUPPORT_PHONE_HREF}');
    expect(dock).toContain("const SUPPORT_PHONE_HREF = 'tel:+79162778989'");
    expect(dock).toContain("const SUPPORT_PHONE_DISPLAY = '8 916 277-89-89'");
  });

  it('uses the browser-visible path and canonicalizes every public home alias', () => {
    expect(contextual).toContain("const PUBLIC_ENTRY_REWRITE_PREFIX = '/pc-public-entry'");
    expect(contextual).toContain("if (!clean || clean === '/') return PUBLIC_HOME");
    expect(contextual).toContain('const rewrittenHome = `${PUBLIC_ENTRY_REWRITE_PREFIX}${PUBLIC_HOME}`');
    expect(contextual).toContain('if (clean === rewrittenHome || clean.startsWith(`${rewrittenHome}/`))');
    expect(contextual).toContain('return clean.slice(PUBLIC_ENTRY_REWRITE_PREFIX.length) || PUBLIC_HOME');
    expect(contextual).toContain("const browserPathname = typeof window === 'undefined' ? routerPathname : window.location.pathname");
    expect(contextual).toContain('const path = normalize(browserPathname || routerPathname)');
  });

  it('keeps every server-public supporting route on the public assistant contract', () => {
    for (const path of [
      '/platform-v7/about',
      '/platform-v7/oferta',
      '/platform-v7/roles',
      '/platform-v7/grain-logistics',
      '/platform-v7/grain-quality',
      '/platform-v7/grain-documents',
      '/platform-v7/grain-payment',
    ]) expect(contextual).toContain(`'${path}'`);
    expect(contextual).toContain("path === prefix || path.startsWith(`${prefix}/`)");
  });

  it('never falls back to a standalone support button on a public surface', () => {
    const publicReturn = contextual.slice(contextual.lastIndexOf('return ('));
    expect(publicReturn).toContain('<UnifiedModalSheetFullscreenController />');
    expect(publicReturn).toContain('<PublicPlatformAssistant />');
    expect(publicReturn).toContain('<ChatSupportWidget />');
    expect(publicReturn).toContain('<PublicContactDock />');
    expect(contextual).toContain('Every public platform surface uses one visible entry point');
  });

  it('mounts the same three-action dock once across every protected workspace', () => {
    const privateBranch = contextual.slice(
      contextual.indexOf('if (isPrivateWorkspace(path))'),
      contextual.indexOf('// Every public platform surface'),
    );
    expect(privateBranch).toContain("<AiAssistantPanel variant='floating' />");
    expect(privateBranch).toContain('<ChatSupportWidget />');
    expect(privateBranch).toContain("<PublicContactDock assistantContext='private' />");
    expect(privateBranch).not.toContain('<PrivateAssistantShortcutLabel />');
    expect(protectedRuntime).toContain('<HydrationSafeChatSupport />');
    expect(designSystemRuntime).not.toContain('<HydrationSafeChatSupport />');
  });

  it('mounts once at both public route boundaries instead of individual headers', () => {
    expect(publicLayout).toContain('if (isPublicPath(pathname)) {');
    expect(publicLayout).toContain('<HydrationSafeChatSupport />');
    expect(publicEntryLayout).toContain('<HydrationSafeChatSupport />');
    expect(publicHeader).not.toContain('<HydrationSafeChatSupport />');
  });

  it('routes the dock AI action to the correct public or private assistant', () => {
    expect(dock).toContain("type AssistantContext = 'public' | 'private' | 'workspace'");
    expect(dock).toContain("assistantContext === 'workspace'");
    expect(dock).toContain("? '#p7-private-ai-assistant-workspace'");
    expect(dock).toContain("? '#p7-private-ai-assistant-panel'");
    expect(dock).toContain("data-assistant-context={assistantContext}");
    expect(dock).toContain('.p7-ai-trigger,');
    expect(privateAssistant).toContain("id={variant === 'floating' ? 'p7-private-ai-assistant-panel' : 'p7-private-ai-assistant-workspace'}");
    expect(privateAssistant).toContain("tabIndex={variant === 'workspace' ? -1 : undefined}");
  });

  it('keeps the dock on the full-page assistant without duplicating its AI panel', () => {
    const workspaceBranch = contextual.slice(
      contextual.indexOf('if (path === ASSISTANT_WORKSPACE)'),
      contextual.indexOf('if (isPrivateWorkspace(path))'),
    );
    expect(workspaceBranch).toContain('<ChatSupportWidget />');
    expect(workspaceBranch).toContain("<PublicContactDock assistantContext='workspace' />");
    expect(workspaceBranch).not.toContain("<AiAssistantPanel variant='floating' />");
    expect(dock).toContain("workspace.scrollIntoView({ block: 'start', behavior: 'smooth' })");
  });

  it('stays above the persistent cabinet navigation instead of covering it', () => {
    expect(dock).toContain(".pc-public-contact-dock[data-assistant-context='private'],");
    expect(dock).toContain(".pc-public-contact-dock[data-assistant-context='workspace']");
    expect(dock).toContain('bottom: max(92px, calc(env(safe-area-inset-bottom, 0px) + 88px))');
    expect(dock).toContain('z-index: 97');
    expect(dock).toContain('.pc-shell-root-v4 .pc-v4-main');
    expect(dock).toContain('padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 156px)');
  });

  it('keeps the call action but does not render the phone number in the dock', () => {
    expect(dock).toContain('<strong>{ui.call}</strong>');
    expect(dock).not.toContain('<small>{SUPPORT_PHONE_DISPLAY}</small>');
    expect(dock).toContain('aria-label={ui.callAria}');
  });

  it('preserves the existing assistant and support workflows without duplicate visible launchers', () => {
    expect(dock).toContain("'.pc-public-assistant-shortcut'");
    expect(dock).toContain("'.p7-support-chat-button'");
    expect(dock).toContain("trigger.setAttribute('tabindex', '-1')");
    expect(dock).toContain("trigger.setAttribute('aria-hidden', 'true')");
    expect(dock).toContain('trigger.click()');
    expect(dock).toContain('MutationObserver');
    expect(dock).toContain('assistantButtonRef.current?.focus()');
    expect(dock).toContain('supportButtonRef.current?.focus()');
  });

  it('does not overlay or intercept either open dialog', () => {
    expect(dock).toContain("document.querySelector('[role=\"dialog\"][aria-modal=\"true\"]')");
    expect(dock).toContain('setDialogOpen(assistantOpen || supportOpen || blockingModalOpen)');
    expect(dock).toContain("data-dialog-open={dialogOpen ? 'true' : 'false'}");
    expect(dock).toContain('aria-hidden={dialogOpen}');
    expect(dock).toContain(".pc-public-contact-dock[data-dialog-open='true']");
    expect(dock).toContain('visibility: hidden');
    expect(dock).toContain('pointer-events: none');
  });

  it('uses a compact balanced three-column composition', () => {
    expect(dock).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(dock).toContain('width: min(380px');
    expect(dock).toContain('gap: 1px');
    expect(dock).toContain('padding: 2px');
    expect(dock).toContain('border: 1px solid rgba(8, 122, 59, .56)');
    expect(dock).toContain('border-radius: 17px');
    expect(dock).toContain('border-radius: 16px');
    expect(dock).not.toContain('border-left: 1px solid');
  });

  it('keeps touch targets accessible while reducing visual weight', () => {
    expect(dock).toContain("className='pc-public-contact-dock-icon'");
    expect(dock).toContain('width: 27px');
    expect(dock).toContain('width: 25px');
    expect(dock).toContain('font-size: 12px');
    expect(dock).toContain('font-size: 11px');
    expect(dock).toContain('font-weight: 700');
    expect(dock).toContain('min-height: 48px');
    expect(dock).toContain('min-height: 46px');
  });

  it('gives the assistant a restrained primary hierarchy', () => {
    expect(dock).toContain("className='pc-public-contact-dock-action pc-public-contact-dock-assistant'");
    expect(dock).toContain('.pc-public-contact-dock-assistant .pc-public-contact-dock-icon');
    expect(dock).toContain('.pc-public-contact-dock-assistant strong');
    expect(dock).toContain('font-weight: 780');
  });

  it('keeps the public palette, lighter glass surface and mobile safe area', () => {
    expect(dock).toContain('background: var(--pc-ppe-v5-surface, #ffffff)');
    expect(dock).toContain('color: var(--pc-ppe-v5-ink, #092118)');
    expect(dock).toContain('color: var(--pc-ppe-v5-green, #087a3b)');
    expect(dock).toContain('backdrop-filter: blur(14px) saturate(125%)');
    expect(dock).toContain('bottom: max(10px, calc(env(safe-area-inset-bottom, 0px) + 8px))');
    expect(dock).toContain('bottom: max(8px, calc(env(safe-area-inset-bottom, 0px) + 6px))');
  });

  it('is localized, mobile-safe and keyboard accessible', () => {
    expect(dock).toContain("assistant: 'AI'");
    expect(dock).toContain("support: 'Support'");
    expect(dock).toContain("assistant: 'AI 助手'");
    expect(dock).toContain("support: '支持'");
    expect(dock).toContain('aria-label={ui.group}');
    expect(dock).toContain("aria-haspopup='dialog'");
    expect(dock).toContain('env(safe-area-inset-bottom');
    expect(dock).toContain('@media (prefers-reduced-motion: reduce)');
    expect(dock).toContain('@media (forced-colors: active)');
  });
});
