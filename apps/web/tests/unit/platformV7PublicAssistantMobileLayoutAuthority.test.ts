import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const authority = read('apps/web/components/platform-v7/PublicAssistantMobileLayoutAuthority.tsx');
const mount = read('apps/web/components/platform-v7/HydrationSafeChatSupport.tsx');

describe('platform-v7 public assistant mobile layout authority', () => {
  it('is mounted on every public assistant surface before the assistant appears', () => {
    expect(mount).toContain("import { PublicAssistantMobileLayoutAuthority }");
    expect(mount).toContain('<PublicAssistantMobileLayoutAuthority />');
    expect(mount.indexOf('<PublicAssistantMobileLayoutAuthority />'))
      .toBeLessThan(mount.indexOf('<ContextualSupportOrAssistant'));
  });

  it('uses one visual-viewport coordinate system rather than top plus calculated bottom', () => {
    expect(authority).toContain('viewport?.offsetTop');
    expect(authority).toContain('viewport?.pageTop');
    expect(authority).toContain('viewport?.offsetLeft');
    expect(authority).toContain('viewport?.width');
    expect(authority).toContain('viewport?.height');
    expect(authority).toContain("setImportant(panel, 'top', `${visualTop}px`)");
    expect(authority).toContain("setImportant(panel, 'left', `${visualLeft}px`)");
    expect(authority).toContain("setImportant(panel, 'width', `${visualWidth}px`)");
    expect(authority).toContain("setImportant(panel, 'height', `${visualHeight}px`)");
    expect(authority).toContain("setImportant(panel, 'bottom', 'auto')");
    expect(authority).not.toContain("inlinePixelVariable(root, '--pc-visual-viewport-bottom')");
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
    expect(authority).not.toContain("panel.style.setProperty('padding-bottom', `${footerHeight}px`, 'important')");
  });

  it('locks the page without blocking native scrolling inside the message list', () => {
    expect(authority).toContain("root.dataset.pcPublicAssistantScrollLock = 'true'");
    expect(authority).toContain("setImportant(root, 'overflow', 'hidden')");
    expect(authority).toContain("setImportant(body, 'position', 'fixed')");
    expect(authority).toContain("setImportant(body, 'top', `${-scrollLock.y}px`)");
    expect(authority).toContain("setImportant(messages, 'overflow-y', 'auto')");
    expect(authority).not.toContain("setImportant(root, 'touch-action', 'none')");
    expect(authority).not.toContain("'touch-action'");
    expect(authority).toContain('restoreProperties(root, locked.root)');
    expect(authority).toContain('restoreProperties(body, locked.body)');
    expect(authority).toContain('window.scrollTo(locked.x, locked.y)');
  });

  it('covers the full visual viewport with an opaque panel and matching backdrop', () => {
    expect(authority).toContain("setImportant(panel, 'background', '#ffffff')");
    expect(authority).toContain("setImportant(messages, 'background', '#ffffff')");
    expect(authority).toContain("setImportant(backdrop, 'top', `${visualTop}px`)");
    expect(authority).toContain("setImportant(backdrop, 'height', `${visualHeight}px`)");
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
    expect(authority).toContain('new ResizeObserver(() => schedule())');
  });

  it('does not change desktop layout and removes its inline authority during cleanup', () => {
    expect(authority).toContain("const MOBILE_QUERY = '(max-width: 720px)'");
    expect(authority).toContain('if (!panel || !media.matches)');
    expect(authority).toContain('clearMobileAuthority(panel)');
    expect(authority).toContain('unlockPage()');
    expect(authority).toContain("delete panel.dataset.pcMobileViewportAuthority");
    expect(authority).toContain('removeProperties(node, FOOTER_STYLE_PROPERTIES)');
  });
});
