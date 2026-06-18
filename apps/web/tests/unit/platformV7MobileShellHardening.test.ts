import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const entryFixCss = fs.readFileSync(path.join(process.cwd(), 'apps/web/styles/platform-v7-entry-fix.css'), 'utf8');
const shellUx = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7ShellUxController.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/layout.tsx'), 'utf8');
const supportHeaderIcon = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/SupportHeaderIcon.tsx'), 'utf8');

describe('platform-v7 mobile shell hardening', () => {
  it('keeps active header and role dock visible above content on mobile', () => {
    expect(entryFixCss).toContain('html body .pc-v4-header{display:block!important;position:fixed!important');
    expect(entryFixCss).toContain('z-index:520!important');
    expect(entryFixCss).toContain('html body .pc-v7-role-dock{display:block!important;position:fixed!important');
    expect(entryFixCss).toContain('z-index:500!important');
    expect(entryFixCss).toContain('html body .pc-v4-bottomnav{display:none!important}');
  });

  it('keeps the ordinary calculator visible in the mobile header action set', () => {
    expect(layout).toContain('<CalculatorHeaderWidget />');
    expect(entryFixCss).toContain('html body .p7-calc-widget{display:inline-flex!important');
    expect(entryFixCss).toContain('order:30!important');
    expect(entryFixCss).toContain("html body .pc-v4-search,html body .pc-v4-theme-toggle,html body .pc-v4-actions button[aria-label='Открыть уведомления']{display:none!important}");
  });

  it('prevents header support styles from restoring the legacy bottom navigation', () => {
    expect(supportHeaderIcon).toContain('.pc-v4-bottomnav{display:none!important}');
    expect(supportHeaderIcon).toContain('.pc-v7-role-dock{display:block!important');
    expect(supportHeaderIcon).not.toContain('.pc-v4-bottomnav{display:block!important');
    expect(supportHeaderIcon).not.toContain('.pc-v7-role-dock{display:none!important');
  });

  it('does not reintroduce utility actions into the role dock implementation', () => {
    const dockBlock = shellUx.slice(shellUx.indexOf('<nav className="pc-v7-role-dock"'), shellUx.indexOf('</nav>', shellUx.indexOf('<nav className="pc-v7-role-dock"')));
    expect(dockBlock).not.toContain('ИИ');
    expect(dockBlock).not.toContain('Меню');
    expect(dockBlock).not.toContain('LogOut');
  });
});
