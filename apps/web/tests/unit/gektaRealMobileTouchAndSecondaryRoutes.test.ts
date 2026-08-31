import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const shell = read('apps/web/components/gekta/GektaProductShell.tsx');
const viewport = read('apps/web/components/gekta/GektaViewportAuthority.tsx');
const composer = read('apps/web/components/gekta/GektaComposer.tsx');
const sidebar = read('apps/web/components/gekta/GektaSidebar.tsx');
const discovery = read('apps/web/components/gekta/GektaDiscoverySections.tsx');
const footer = read('apps/web/components/gekta/GektaLegalFooter.tsx');
const utility = read('apps/web/components/gekta/GektaUtilityPage.tsx');
const topic = read('apps/web/components/gekta/GektaTopicPage.tsx');

const utilityRoutes = [
  'apps/web/app/gekta/security/page.tsx',
  'apps/web/app/gekta/support/page.tsx',
  'apps/web/app/gekta/en/security/page.tsx',
  'apps/web/app/gekta/en/support/page.tsx',
  'apps/web/app/gekta/zh/security/page.tsx',
  'apps/web/app/gekta/zh/support/page.tsx',
];

describe('Gekta real-mobile touch and secondary-route contract', () => {
  it('does not globally lock document scrolling when the mobile keyboard changes visualViewport', () => {
    expect(viewport).not.toContain("root.style.overflow = 'hidden'");
    expect(viewport).not.toContain("document.body.style.overflow = 'hidden'");
    expect(viewport).not.toContain('setDocumentLock');
    expect(viewport).toContain("root.dataset.gektaKeyboardOpen = 'true'");
  });

  it('keeps discovery in document flow and moves only the focused composer for keyboard ownership', () => {
    expect(shell).toContain("[data-gekta-chat-workspace='true'].overflow-hidden");
    expect(shell).toContain("html[data-gekta-keyboard-open='true'] [data-gekta-chat-workspace='true']:not(.overflow-hidden):has(#gekta-composer-input:focus) [data-gekta-composer-root='true']");
    expect(shell).not.toContain("html[data-gekta-keyboard-open='true'] [data-gekta-chat-workspace='true']:not(.overflow-hidden) {\n    position: fixed");
    expect(shell).toContain('-webkit-overflow-scrolling: touch');
    expect(shell).toContain('scroll-behavior: auto !important');
  });

  it('keeps one discovery portal parent across keyboard cycles instead of reparenting on focus', () => {
    expect(composer).toContain('createPortal');
    expect(composer).toContain("workspace.querySelector<HTMLElement>(\"[data-gekta-composer-slot='true']\")");
    expect(composer).toContain("workspace.classList.contains('overflow-hidden')");
    expect(composer).not.toContain('RelocationState');
    expect(composer).not.toContain('gektaKeyboardOpen');
    expect(composer).toContain("textareaRef.current?.focus({ preventScroll: true })");
  });

  it('keeps support and security navigation inside the Gekta product surface', () => {
    expect(sidebar).toContain("utilityRoute(locale, 'security')");
    expect(sidebar).toContain("utilityRoute(locale, 'support')");
    expect(sidebar).not.toContain("href='/platform-v7/trust'");
    expect(sidebar).not.toContain("href='/platform-v7/contact'");
    expect(discovery).toContain("`${GEKTA_PATHS[locale]}/security`");
    expect(discovery).not.toContain("href='/platform-v7/trust'");
    expect(footer).toContain("`${GEKTA_PATHS[locale]}/support`");
    expect(footer).not.toContain("href='/platform-v7/contact'");
    expect(topic).toContain("href='/gekta/security'");
    expect(topic).toContain("href='/gekta/support'");
  });

  it('provides real RU, EN and ZH Gekta utility routes with mobile-safe actions', () => {
    for (const route of utilityRoutes) expect(fs.existsSync(path.join(process.cwd(), route))).toBe(true);
    expect(utility).toContain("data-gekta-utility-page={kind}");
    expect(utility).toContain('min-h-11');
    expect(utility).toContain('min-h-12');
    expect(utility).toContain("overflow-x-clip");
    expect(utility).toContain("fetch('/api/platform-v7/inquiries'");
    expect(utility).toContain("source: 'support_chat'");
    expect(utility).not.toContain("action='/api/platform-v7/inquiries'");
  });
});
