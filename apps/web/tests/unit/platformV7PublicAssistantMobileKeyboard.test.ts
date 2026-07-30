import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const controller = read('apps/web/components/platform-v7/ContextualSupportOrAssistant.tsx');
const css = read('apps/web/styles/platform-v7-public-assistant-mobile-hotfix.css');

describe('platform-v7 public assistant mobile keyboard contract', () => {
  it('tracks the visual viewport and rechecks after composer focus changes', () => {
    expect(controller).toContain('window.visualViewport');
    expect(controller).toContain("document.addEventListener('focusin', scheduleFocusSync)");
    expect(controller).toContain("document.addEventListener('focusout', scheduleFocusSync)");
    expect(controller).toContain("active.closest('.pc-public-assistant-composer')");
    expect(controller).toContain("panel.dataset.pcKeyboardViewport = 'true'");
    expect(controller).toContain('--pc-ai-keyboard-height');
  });

  it('never makes the sheet taller than the measured visual viewport', () => {
    expect(controller).toContain('const usableHeight = Math.max(1, height - 2)');
    expect(controller).not.toContain('Math.max(240, height');
    expect(css).toContain(".pc-public-assistant-panel[data-pc-keyboard-viewport='true']");
    expect(css).toContain('top: var(--pc-ai-keyboard-top, 0px) !important');
    expect(css).toContain('height: var(--pc-ai-keyboard-height, 100dvh) !important');
    expect(css).toContain('max-height: var(--pc-ai-keyboard-height, 100dvh) !important');
    expect(css).toContain('bottom: auto !important');
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
