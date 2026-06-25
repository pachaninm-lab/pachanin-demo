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

  it('keeps every mobile header action in one compact ordered row', () => {
    expect(widgetFile).not.toContain('.pc-v7-logout-btn{display:none!important}');
    expect(layoutFile).toContain('grid-template-columns:repeat(7,30px)!important');
    expect(layoutFile).toContain('.pc-v4-search{order:10!important;grid-column:1!important}');
    expect(layoutFile).toContain('.pc-v4-theme-toggle{order:20!important;grid-column:2!important}');
    expect(layoutFile).toContain('.p7-note-widget{order:30!important;grid-column:3!important}');
    expect(layoutFile).toContain('.pc-v7-notice-wrap{order:40!important;grid-column:4!important');
    expect(layoutFile).toContain('.p7-role-support{order:50!important;grid-column:5!important}');
    expect(layoutFile).toContain('.p7-calc-widget{order:60!important;grid-column:6!important}');
    expect(layoutFile).toContain('.pc-v7-logout-btn{order:100!important;grid-column:7!important}');
    expect(layoutFile).toContain('inline-size:30px!important;min-inline-size:30px!important;max-inline-size:30px!important');
    expect(layoutFile).toContain('.pc-v4-header{min-block-size:58px!important;max-block-size:64px!important}');
    expect(layoutFile).toContain('.pc-v4-header-inner{position:relative!important;overflow:visible!important;padding:8px!important;min-block-size:56px!important;max-block-size:60px!important}');
    expect(layoutFile).not.toContain('padding:calc(env(safe-area-inset-top) + 7px) 8px!important');
  });
});
