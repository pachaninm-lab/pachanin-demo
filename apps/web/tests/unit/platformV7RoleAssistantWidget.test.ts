import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const widgetFile = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/RoleAssistantWidget.tsx'), 'utf8');
const layoutFile = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/layout.tsx'), 'utf8');
const layoutClientFile = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7LayoutClient.tsx'), 'utf8');

describe('platform-v7 role assistant widget', () => {
  it('mounts the assistant from the protected platform shell', () => {
    expect(layoutClientFile).toContain("import { RoleAssistantWidget }");
    expect(layoutClientFile).toContain('<RoleAssistantWidget />');
  });

  it('keeps assistant out of public platform pages', () => {
    expect(widgetFile).toContain('PUBLIC_PATHS');
    expect(widgetFile).toContain("'/platform-v7/login'");
    expect(widgetFile).toContain("'/platform-v7/register'");
    expect(widgetFile).toContain('return null');
  });

  it('hides assistant from bottom and drawer navigation surfaces', () => {
    expect(widgetFile).toContain(".pc-v7-role-dock a[href='/platform-v7/ai']");
    expect(widgetFile).toContain(".pc-v7-safe-drawer-link[href='/platform-v7/ai']");
    expect(widgetFile).toContain(".pc-v4-bottomnav a[href='/platform-v7/ai']");
  });

  it('keeps logout visible as the far-right mobile header action', () => {
    expect(widgetFile).not.toContain('.pc-v7-logout-btn{display:none!important}');
    expect(layoutFile).toContain('.pc-v7-logout-btn{order:100!important}');
    expect(layoutFile).toContain('.pc-v4-search{order:10!important}');
    expect(layoutFile).toContain('.p7-role-support{order:50!important}');
    expect(layoutFile).toContain('html body .pc-shell-root-v4 .pc-v4-search,html body .pc-shell-root-v4 .pc-v4-theme-toggle');
  });
});
