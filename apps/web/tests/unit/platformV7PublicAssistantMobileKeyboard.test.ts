import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const controller = read('apps/web/components/platform-v7/ContextualSupportOrAssistant.tsx');
const css = read('apps/web/styles/platform-v7-public-assistant-mobile-hotfix.css');

describe('platform-v7 public assistant mobile keyboard contract', () => {
  it('tracks visual viewport and optional VirtualKeyboard geometry through the full animation', () => {
    expect(controller).toContain('window.visualViewport');
    expect(controller).toContain('NavigatorWithVirtualKeyboard');
    expect(controller).toContain("virtualKeyboard?.addEventListener('geometrychange', scheduleMeasure)");
    expect(controller).toContain('virtualKeyboard.overlaysContent = true');
    expect(controller).toContain("document.addEventListener('focusin', handleFocusIn)");
    expect(controller).toContain("document.addEventListener('focusout', handleFocusOut)");
    expect(controller).toContain("target.closest('.pc-public-assistant-composer')");
    expect(controller).toContain('[40, 100, 180, 300, 480, 700, 1_000, 1_400, 1_900]');
  });

  it('derives overlay keyboard top from stable height instead of an unreliable top coordinate', () => {
    expect(controller).toContain('const keyboardTopFromHeight = keyboardHeight > 0');
    expect(controller).toContain('layoutBottom - keyboardHeight');
    expect(controller).toContain('Math.max(visualBottom, keyboardTopFromHeight)');
    expect(controller).not.toContain('keyboardRect?.top');
    expect(controller).toContain("panel.dataset.pcKeyboardGeometry = keyboardHeight > 0 ? 'keyboard-height' : 'visual-viewport'");
  });

  it('anchors the focused sheet by exact top and bottom edges with no exposed page strip', () => {
    expect(controller).toContain("panel.style.setProperty('--pc-ai-keyboard-bottom', `${keyboardBottomInset}px`)");
    expect(css).toContain(".pc-public-assistant-panel[data-pc-keyboard-focus='true']");
    expect(css).toContain('--pc-ai-keyboard-bottom,');
    expect(css).toContain('height: auto !important');
    expect(css).toContain('max-height: none !important');
    expect(css).not.toContain('--pc-ai-keyboard-height,');
    expect(css).toContain('border-radius: 0 !important');
  });

  it('removes the redundant frame but retains a compact keyboard-focus cue', () => {
    expect(css).toContain('.pc-public-assistant-composer-shell:focus-within');
    expect(css).toContain('box-shadow: none !important');
    expect(css).toContain('.pc-public-assistant-composer-shell:has(textarea:focus-visible)');
    expect(css).toContain('box-shadow: inset 0 -2px 0 rgba(8, 122, 59, 0.62) !important');
    expect(css).toContain('outline: 2px solid Highlight !important');
  });

  it('keeps the assistant visually light', () => {
    expect(css).toContain('.pc-site-header .pc-site-brand-text strong');
    expect(css).toContain('font-weight: 650 !important');
    expect(css).toContain('background: rgba(9, 33, 24, 0.18) !important');
    expect(css).toContain('background: #ffffff !important');
  });
});
