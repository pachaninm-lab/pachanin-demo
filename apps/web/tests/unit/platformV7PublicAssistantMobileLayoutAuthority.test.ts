import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const authority = read('apps/web/components/platform-v7/PublicAssistantMobileLayoutAuthority.tsx');
const mount = read('apps/web/components/platform-v7/HydrationSafeChatSupport.tsx');
const contextual = read('apps/web/components/platform-v7/ContextualSupportOrAssistant.tsx');
const hotfixCss = read('apps/web/styles/platform-v7-public-assistant-mobile-hotfix.css');

describe('platform-v7 public assistant mobile layout authority', () => {
  it('is mounted on every public assistant surface before the assistant appears', () => {
    expect(mount).toContain("import { PublicAssistantMobileLayoutAuthority }");
    expect(mount).toContain('<PublicAssistantMobileLayoutAuthority />');
    expect(mount.indexOf('<PublicAssistantMobileLayoutAuthority />'))
      .toBeLessThan(mount.indexOf('<ContextualSupportOrAssistant'));
  });

  it('has exactly one runtime keyboard geometry controller', () => {
    expect(authority).toContain('window.visualViewport');
    expect(authority).toContain('NavigatorWithVirtualKeyboard');
    expect(contextual).not.toContain('useVisualViewportMetrics');
    expect(contextual).not.toContain('window.visualViewport');
    expect(contextual).not.toContain('NavigatorWithVirtualKeyboard');
    expect(hotfixCss).not.toContain("data-pc-keyboard-focus='true'");
    expect(hotfixCss).not.toContain("data-pc-keyboard-viewport='true'");
    expect(hotfixCss).not.toContain('--pc-ai-keyboard-top');
    expect(hotfixCss).not.toContain('--pc-ai-keyboard-bottom');
  });

  it('uses one visual-viewport coordinate system and never mixes in pageTop', () => {
    expect(authority).toContain('viewport?.offsetTop');
    expect(authority).toContain('viewport?.offsetLeft');
    expect(authority).toContain('viewport?.width');
    expect(authority).toContain('viewport?.height');
    expect(authority).not.toContain('viewport?.pageTop');
    expect(authority).toContain("setImportant(panel, 'top', `${metrics.visualTop}px`)");
    expect(authority).toContain("setImportant(panel, 'left', `${metrics.visualLeft}px`)");
    expect(authority).toContain("setImportant(panel, 'width', `${metrics.visualWidth}px`)");
    expect(authority).toContain("setImportant(panel, 'height', `${visibleHeight}px`)");
    expect(authority).toContain("setImportant(panel, 'bottom', 'auto')");
  });

  it('reconciles all resized viewport signals and ignores unchanged layout metrics', () => {
    expect(authority).toContain('const KEYBOARD_DELTA_PX = 120');
    expect(authority).toContain('baselineVisualBottom - metrics.visualBottom >= KEYBOARD_DELTA_PX');
    expect(authority).toContain('baseline.innerHeight - metrics.innerHeight >= KEYBOARD_DELTA_PX');
    expect(authority).toContain('baseline.clientHeight - metrics.clientHeight >= KEYBOARD_DELTA_PX');
    expect(authority).toContain("source: 'visual-viewport'");
    expect(authority).toContain("source: 'window-inner-height'");
    expect(authority).toContain("source: 'document-client-height'");
    expect(authority).toContain('Math.max(...candidates.map(({ bottom }) => bottom))');
  });

  it('uses VirtualKeyboard height as a hard upper bound when available', () => {
    expect(authority).toContain('virtualKeyboard?.boundingRect?.height');
    expect(authority).toContain("virtualKeyboard?.addEventListener('geometrychange', schedule)");
    expect(authority).toContain('baselineLayoutBottom - metrics.keyboardHeight');
    expect(authority).toContain('candidate = Math.min(candidate, keyboardTopFromHeight)');
    expect(authority).not.toContain('boundingRect?.top');
  });

  it('rejects isolated post-animation downward viewport jumps', () => {
    expect(authority).toContain('const FOCUS_SETTLE_GRACE_MS = 800');
    expect(authority).toContain('const DOWNWARD_GUARD_PX = 24');
    expect(authority).toContain('const DOWNWARD_CONFIRMATION_COUNT = 6');
    expect(authority).toContain('pendingDownwardBottom');
    expect(authority).toContain('pendingDownwardCount >= DOWNWARD_CONFIRMATION_COUNT');
  });

  it('keeps header messages and composer in one flex column', () => {
    expect(authority).toContain("setImportant(panel, 'display', 'flex')");
    expect(authority).toContain("setImportant(panel, 'flex-direction', 'column')");
    expect(authority).toContain("setImportant(messages, 'flex', '1 1 auto')");
    expect(authority).toContain("setImportant(node, 'position', 'relative')");
    expect(authority).toContain("setImportant(node, 'bottom', 'auto')");
    expect(authority).toContain("setImportant(node, 'flex', '0 0 auto')");
    expect(authority).not.toContain("node.style.setProperty('position', 'absolute', 'important')");
    expect(authority).not.toContain('bottomOffset += height');
  });

  it('locks background scrolling without fixing the body and perturbing viewport metrics', () => {
    expect(authority).toContain("root.dataset.pcPublicAssistantScrollLock = 'true'");
    expect(authority).toContain("setImportant(root, 'overflow', 'hidden')");
    expect(authority).toContain("setImportant(body, 'overflow', 'hidden')");
    expect(authority).not.toContain("setImportant(body, 'position', 'fixed')");
    expect(authority).not.toContain("setImportant(body, 'top'");
    expect(authority).toContain("setImportant(messages, 'overflow-y', 'auto')");
    expect(authority).toContain('restoreProperties(root, locked.root)');
    expect(authority).toContain('restoreProperties(body, locked.body)');
    expect(authority).toContain('window.scrollTo(locked.x, locked.y)');
  });

  it('covers the resolved visible viewport with an opaque panel and matching backdrop', () => {
    expect(authority).toContain("setImportant(panel, 'background', '#ffffff')");
    expect(authority).toContain("setImportant(messages, 'background', '#ffffff')");
    expect(authority).toContain("setImportant(backdrop, 'top', `${metrics.visualTop}px`)");
    expect(authority).toContain("setImportant(backdrop, 'height', `${visibleHeight}px`)");
    expect(authority).toContain("setImportant(backdrop, 'bottom', 'auto')");
  });

  it('remeasures delayed WebKit keyboard geometry only while the dialog is open', () => {
    expect(authority).toContain("viewport?.addEventListener('resize', schedule)");
    expect(authority).toContain("viewport?.addEventListener('scroll', schedule)");
    expect(authority).toContain("viewport?.addEventListener('scrollend', schedule)");
    expect(authority).toContain("document.addEventListener('focusin', schedule)");
    expect(authority).toContain("document.addEventListener('focusout', schedule)");
    expect(authority).toContain('new MutationObserver(schedule)');
    expect(authority).toContain('window.setInterval(schedule, 120)');
    expect(authority).toContain('new ResizeObserver(schedule)');
  });

  it('does not change desktop layout and removes inline authority during cleanup', () => {
    expect(authority).toContain("const MOBILE_QUERY = '(max-width: 720px)'");
    expect(authority).toContain('if (!panel || !media.matches)');
    expect(authority).toContain('clearMobileAuthority(panel)');
    expect(authority).toContain('clearRootViewport()');
    expect(authority).toContain('unlockPage()');
    expect(authority).toContain("delete panel.dataset.pcMobileViewportAuthority");
    expect(authority).toContain("delete panel.dataset.pcKeyboardFocus");
    expect(authority).toContain('removeProperties(node, FOOTER_STYLE_PROPERTIES)');
  });
});
