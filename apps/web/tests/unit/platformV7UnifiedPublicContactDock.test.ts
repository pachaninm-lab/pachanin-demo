import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const contextual = read('apps/web/components/platform-v7/ContextualSupportOrAssistant.tsx');
const dock = read('apps/web/components/platform-v7/PublicContactDock.tsx');

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
    expect(dock).toContain('setDialogOpen(assistantOpen || supportOpen)');
    expect(dock).toContain("data-dialog-open={dialogOpen ? 'true' : 'false'}");
    expect(dock).toContain('aria-hidden={dialogOpen}');
    expect(dock).toContain(".pc-public-contact-dock[data-dialog-open='true']");
    expect(dock).toContain('visibility: hidden');
    expect(dock).toContain('pointer-events: none');
  });

  it('uses the public-page palette and stays close to the mobile safe area', () => {
    expect(dock).toContain('background: var(--pc-ppe-v5-surface, #ffffff)');
    expect(dock).toContain('color: var(--pc-ppe-v5-ink, #092118)');
    expect(dock).toContain('color: var(--pc-ppe-v5-green, #087a3b)');
    expect(dock).toContain('border: 1px solid var(--pc-ppe-v5-line, #cfdcd4)');
    expect(dock).toContain('bottom: max(6px, calc(env(safe-area-inset-bottom, 0px) + 4px))');
    expect(dock).toContain('bottom: max(2px, calc(env(safe-area-inset-bottom, 0px) + 2px))');
  });

  it('is localized, mobile-safe and keyboard accessible', () => {
    expect(dock).toContain("assistant: 'AI'");
    expect(dock).toContain("support: 'Support'");
    expect(dock).toContain("assistant: 'AI 助手'");
    expect(dock).toContain("support: '支持'");
    expect(dock).toContain('aria-label={ui.group}');
    expect(dock).toContain("aria-haspopup='dialog'");
    expect(dock).toContain('env(safe-area-inset-bottom');
    expect(dock).toContain('min-height: 58px');
    expect(dock).toContain('@media (prefers-reduced-motion: reduce)');
    expect(dock).toContain('@media (forced-colors: active)');
  });
});
