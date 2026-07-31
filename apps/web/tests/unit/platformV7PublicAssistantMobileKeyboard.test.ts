import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const authority = read('apps/web/components/platform-v7/PublicAssistantMobileLayoutAuthority.tsx');
const contextual = read('apps/web/components/platform-v7/ContextualSupportOrAssistant.tsx');
const hotfixCss = read('apps/web/styles/platform-v7-public-assistant-mobile-hotfix.css');
const polishCss = read('apps/web/styles/platform-v7-public-assistant-polish.css');

describe('platform-v7 public assistant mobile keyboard contract', () => {
  it('tracks visual viewport and optional VirtualKeyboard geometry through the full animation', () => {
    expect(authority).toContain('window.visualViewport');
    expect(authority).toContain('NavigatorWithVirtualKeyboard');
    expect(authority).toContain("virtualKeyboard?.addEventListener('geometrychange', schedule)");
    expect(authority).not.toContain('overlaysContent = true');
    expect(authority).toContain("document.addEventListener('focusin', schedule)");
    expect(authority).toContain("document.addEventListener('focusout', schedule)");
    expect(authority).toContain("active.closest(COMPOSER_SELECTOR)");
    expect(authority).toContain('window.setInterval(schedule, 120)');
  });

  it('uses VirtualKeyboard as a hard upper bound instead of crossing an overlay keyboard', () => {
    expect(authority).toContain('const keyboardTopFromHeight = Math.max(');
    expect(authority).toContain('baselineLayoutBottom - metrics.keyboardHeight');
    expect(authority).toContain('candidate = Math.min(candidate, keyboardTopFromHeight)');
    expect(authority).not.toContain('Math.max(candidate, keyboardTopFromHeight)');
    expect(authority).not.toContain('boundingRect?.top');
    expect(authority).toContain('panel.dataset.pcKeyboardGeometry = geometry');
  });

  it('reconciles Yandex iOS browser chrome from independently contracted metrics', () => {
    expect(authority).toContain('const KEYBOARD_DELTA_PX = 120');
    expect(authority).toContain('visualBottom: visualTop + visualHeight');
    expect(authority).toContain('baseline.innerHeight - metrics.innerHeight >= KEYBOARD_DELTA_PX');
    expect(authority).toContain('baseline.clientHeight - metrics.clientHeight >= KEYBOARD_DELTA_PX');
    expect(authority).toContain('candidates.push({ bottom: metrics.visualBottom');
    expect(authority).toContain('candidates.push({ bottom: innerBottom');
    expect(authority).toContain('candidates.push({ bottom: clientBottom');
    expect(authority).toContain('Math.max(...candidates.map(({ bottom }) => bottom))');
  });

  it('binds the panel to the exact reconciled visual top and height', () => {
    expect(authority).toContain("panel.style.setProperty('--pc-ai-visible-top', `${metrics.visualTop}px`)");
    expect(authority).toContain("panel.style.setProperty('--pc-ai-visible-height', `${visibleHeight}px`)");
    expect(authority).toContain("setImportant(panel, 'top', `${metrics.visualTop}px`)");
    expect(authority).toContain("setImportant(panel, 'height', `${visibleHeight}px`)");
    expect(authority).toContain("setImportant(panel, 'bottom', 'auto')");
    expect(polishCss).toContain('border-radius: 0 !important');
  });

  it('keeps runtime geometry out of the contextual component and CSS hotfix', () => {
    expect(contextual).not.toContain('useVisualViewportMetrics');
    expect(contextual).not.toContain('window.visualViewport');
    expect(hotfixCss).toContain('Runtime viewport geometry is owned exclusively');
    expect(hotfixCss).not.toContain('--pc-ai-keyboard-top');
    expect(hotfixCss).not.toContain('--pc-ai-keyboard-bottom');
    expect(hotfixCss).not.toContain("data-pc-keyboard-focus='true'");
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

  it('keeps the composer in normal flex flow at the visible bottom', () => {
    expect(authority).toContain("setImportant(node, 'position', 'relative')");
    expect(authority).toContain("setImportant(node, 'bottom', 'auto')");
    expect(authority).toContain("setImportant(node, 'flex', '0 0 auto')");
    expect(polishCss).toContain('flex: 0 0 auto !important');
    expect(polishCss).toContain('padding-bottom: 8px !important');
    expect(polishCss).toContain('overflow: hidden !important');
    expect(polishCss).toContain('.pc-public-assistant-privacy');
    expect(polishCss).toContain('align-content: center !important');
    expect(polishCss).toContain('align-content: start !important');
  });
});
