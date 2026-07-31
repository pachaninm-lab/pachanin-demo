import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const controller = read('apps/web/components/platform-v7/ContextualSupportOrAssistant.tsx');
const hotfixCss = read('apps/web/styles/platform-v7-public-assistant-mobile-hotfix.css');
const polishCss = read('apps/web/styles/platform-v7-public-assistant-polish.css');

describe('platform-v7 public assistant mobile keyboard contract', () => {
  it('tracks visual viewport and optional VirtualKeyboard geometry through the full animation', () => {
    expect(controller).toContain('window.visualViewport');
    expect(controller).toContain('NavigatorWithVirtualKeyboard');
    expect(controller).toContain("virtualKeyboard?.addEventListener('geometrychange', scheduleMeasure)");
    expect(controller).not.toContain('overlaysContent = true');
    expect(controller).toContain("document.addEventListener('focusin', handleFocusIn)");
    expect(controller).toContain("document.addEventListener('focusout', handleFocusOut)");
    expect(controller).toContain("target.closest('.pc-public-assistant-composer')");
    expect(controller).toContain('[40, 100, 180, 300, 480, 700, 1_000, 1_400, 1_900]');
  });

  it('uses the earlier reliable visible edge instead of exposing a strip above an overlay keyboard', () => {
    expect(controller).toContain('const keyboardTopFromHeight = Math.max(visualTop + 1, layoutBottom - keyboardHeight)');
    expect(controller).toContain('Math.min(visualBottom, keyboardTopFromHeight)');
    expect(controller).not.toContain('Math.max(visualBottom, keyboardTopFromHeight)');
    expect(controller).not.toContain('keyboardRect?.top');
    expect(controller).toContain("panel.dataset.pcKeyboardGeometry = geometry");
  });

  it('binds the mobile panel to exact visual top and height before and during keyboard focus', () => {
    expect(controller).toContain("panel.style.setProperty('--pc-ai-visible-top', `${visualTop}px`)");
    expect(controller).toContain("panel.style.setProperty('--pc-ai-visible-height', `${activeHeight}px`)");
    expect(polishCss).toContain(".pc-public-assistant-panel[data-pc-keyboard-focus='true']");
    expect(polishCss).toContain('top: var(--pc-ai-visible-top, var(--pc-visual-viewport-top, 0px)) !important');
    expect(polishCss).toContain('height: var(--pc-ai-visible-height, var(--pc-visual-viewport-height, 100dvh)) !important');
    expect(polishCss).toContain('bottom: auto !important');
    expect(polishCss).toContain('border-radius: 0 !important');
  });

  it('keeps implementation labels, wait copy and feedback controls off the public surface', () => {
    expect(polishCss).toContain(".pc-public-assistant-message[data-role='assistant'][data-origin]");
    expect(polishCss).toContain("button[aria-label='Ответ полезен']");
    expect(polishCss).toContain("button[aria-label='Сообщить об ошибке']");
    expect(polishCss).toContain('.pc-public-assistant-processing span');
    expect(polishCss).toContain('.pc-public-assistant-stream-provisional');
    expect(polishCss).toContain('clip-path: inset(50%) !important');
    expect(hotfixCss).toContain('public users do not see implementation labels');
  });

  it('removes the bottom-only focus stripe and retains a restrained full-field cue', () => {
    expect(polishCss).toContain('.pc-public-assistant-composer-shell:focus-within');
    expect(polishCss).toContain('.pc-public-assistant-composer-shell:has(textarea:focus-visible)');
    expect(polishCss).toContain('box-shadow: 0 0 0 2px rgba(8, 122, 59, 0.1) !important');
    expect(polishCss).not.toContain('inset 0 -2px');
    expect(polishCss).toContain('border-color: #b8d0c1 !important');
  });

  it('uses one compact mobile header and non-clipped prompt actions', () => {
    expect(polishCss).toContain('grid-template-columns: minmax(0, 1fr) 44px !important');
    expect(polishCss).toContain('> .pc-public-assistant-icon-button:first-of-type');
    expect(polishCss).toContain('display: none !important');
    expect(polishCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important');
    expect(polishCss).toContain('white-space: normal !important');
    expect(polishCss).toContain('grid-column: 1 / -1 !important');
  });

  it('keeps the composer as the final fixed flex item immediately above the keyboard', () => {
    expect(polishCss).toContain('flex: 0 0 auto !important');
    expect(polishCss).toContain('padding-bottom: 8px !important');
    expect(polishCss).toContain('height: var(--pc-ai-visible-height');
    expect(polishCss).toContain('overflow: hidden !important');
  });
});
