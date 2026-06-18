import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const widgetFile = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/RoleAssistantWidget.tsx'), 'utf8');
const layoutFile = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7LayoutClient.tsx'), 'utf8');

describe('platform-v7 role assistant widget', () => {
  it('mounts the assistant from the protected platform shell', () => {
    expect(layoutFile).toContain("import { RoleAssistantWidget }");
    expect(layoutFile).toContain('<RoleAssistantWidget />');
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

  it('removes logout from the primary mobile header action set', () => {
    expect(widgetFile).toContain('@media(max-width:640px)');
    expect(widgetFile).toContain('.pc-v7-logout-btn{display:none!important}');
  });
});
