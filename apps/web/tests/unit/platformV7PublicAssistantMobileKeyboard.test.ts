import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const controller = read('apps/web/components/platform-v7/ContextualSupportOrAssistant.tsx');
const css = read('apps/web/styles/platform-v7-public-assistant-mobile-hotfix.css');

describe('platform-v7 public assistant mobile keyboard contract', () => {
  it('tracks visual viewport and VirtualKeyboard geometry through the full focus animation', () => {
    expect(controller).toContain('window.visualViewport');
    expect(controller).toContain('NavigatorWithVirtualKeyboard');
    expect(controller).toContain("virtualKeyboard?.addEventListener('geometrychange', scheduleSync)");
    expect(controller).toContain('virtualKeyboard.overlaysContent = true');
    expect(controller).toContain("document.addEventListener('focusin', handleFocusIn)");
    expect(controller).toContain("document.addEventListener('focusout', handleFocusOut)");
    expect(controller).toContain("target.closest('.pc-public-assistant-composer')");
    expect(controller).toContain("panel.dataset.pcKeyboardFocus = 'true'");
    expect(controller).toContain("panel.dataset.pcKeyboardViewport = 'true'");
    expect(controller).toContain('[60, 140, 260, 420, 700, 1_000]');
  });

  it('never makes the sheet taller than the measured visible keyboard viewport', () => {
    expect(controller).toContain('const usableHeight = Math.max(1, visibleBottom - offsetTop - 2)');
    expect(controller).not.toContain('Math.max(240, height');
    expect(css).toContain(".pc-public-assistant-panel[data-pc-keyboard-viewport='true']");
    expect(css).toContain('top: var(--pc-ai-keyboard-top, 0px) !important');
    expect(css).toContain('height: var(--pc-ai-keyboard-height, 100dvh) !important');
    expect(css).toContain('max-height: var(--pc-ai-keyboard-height, 100dvh) !important');
    expect(css).toContain('bottom: auto !important');
  });

  it('raises the compact sheet immediately with the keyboard inset CSS fallback', () => {
    expect(css).toContain("[data-pc-keyboard-focus='true']:not([data-pc-keyboard-viewport='true'])");
    expect(css).toContain('env(keyboard-inset-height, 0px)');
    expect(css).toContain('bottom: var(--pc-ai-effective-keyboard-inset) !important');
    expect(css).toContain("panel.style.setProperty('--pc-ai-keyboard-inset'");
  });

  it('removes the redundant frame but retains a compact keyboard-focus cue', () => {
    expect(css).toContain('.pc-public-assistant-composer-shell:focus-within');
    expect(css).toContain('box-shadow: none !important');
    expect(css).toContain('.pc-public-assistant-composer-shell:has(textarea:focus-visible)');
    expect(css).toContain('box-shadow: inset 0 -2px 0 rgba(8, 122, 59, 0.62) !important');
    expect(css).toContain('outline: 2px solid Highlight !important');
  });

  it('lightens the assistant and reduces the public brand weight', () => {
    expect(css).toContain('.pc-site-header .pc-site-brand-text strong');
    expect(css).toContain('font-weight: 650 !important');
    expect(css).toContain('background: rgba(9, 33, 24, 0.18) !important');
    expect(css).toContain('background: #ffffff !important');
  });
});
