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

  it('binds the panel to exact top and bottom viewport edges instead of a guessed height', () => {
    expect(authority).toContain("inlinePixelVariable(root, '--pc-visual-viewport-top')");
    expect(authority).toContain("inlinePixelVariable(root, '--pc-visual-viewport-bottom')");
    expect(authority).toContain("panel.style.setProperty('top', `${safeTop}px`, 'important')");
    expect(authority).toContain("panel.style.setProperty('bottom', `${safeBottom}px`, 'important')");
    expect(authority).toContain("panel.style.setProperty('height', 'auto', 'important')");
    expect(authority).toContain("panel.style.setProperty('max-height', 'none', 'important')");
  });

  it('removes the composer and any visible footer notices from normal flow and stacks them at the panel bottom', () => {
    expect(authority).toContain("'pc-public-assistant-error'");
    expect(authority).toContain("'pc-public-assistant-reset-proxy'");
    expect(authority).toContain("'pc-public-assistant-composer'");
    expect(authority).toContain("node.style.setProperty('position', 'absolute', 'important')");
    expect(authority).toContain("node.style.setProperty('bottom', `${bottomOffset}px`, 'important')");
    expect(authority).toContain("panel.style.setProperty('padding-bottom', `${footerHeight}px`, 'important')");
    expect(authority).toContain("messages.style.setProperty('flex', '1 1 0%', 'important')");
  });

  it('remeasures browser keyboard animation, late DOM insertion and silent Yandex viewport changes', () => {
    expect(authority).toContain("viewport?.addEventListener('resize', schedule)");
    expect(authority).toContain("viewport?.addEventListener('scroll', schedule)");
    expect(authority).toContain("document.addEventListener('focusin', schedule)");
    expect(authority).toContain("document.addEventListener('focusout', schedule)");
    expect(authority).toContain('new MutationObserver(schedule)');
    expect(authority).toContain('window.setInterval(schedule, 180)');
    expect(authority).toContain('new ResizeObserver(() => schedule())');
  });

  it('does not change desktop layout and fully removes its inline authority during cleanup', () => {
    expect(authority).toContain("const MOBILE_QUERY = '(max-width: 720px)'");
    expect(authority).toContain('if (!panel || !media.matches)');
    expect(authority).toContain('clearMobileAuthority(panel)');
    expect(authority).toContain("delete panel.dataset.pcMobileFooterAuthority");
    expect(authority).toContain('removeProperties(node, FOOTER_STYLE_PROPERTIES)');
  });
});
