import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const widgetFile = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/RoleAssistantWidget.tsx'), 'utf8');
const layoutFile = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/layout.tsx'), 'utf8');
const railFile = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/MobileHeaderActionRail.tsx'), 'utf8');
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

  it('mounts a deterministic mobile action rail after legacy header tools', () => {
    expect(layoutFile).toContain("import { MobileHeaderActionRail }");
    expect(layoutFile).toContain('<MobileHeaderActionRail />');
    expect(railFile).toContain("className='p7-mobile-action-rail'");
    expect(railFile).toContain('grid-template-columns:repeat(7,30px)!important');
    expect(railFile).toContain("aria-label='Открыть поиск'");
    expect(railFile).toContain("aria-label='Открыть блокнот'");
    expect(railFile).toContain("aria-label='Открыть уведомления роли'");
    expect(railFile).toContain("aria-label='Статус и помощь'");
    expect(railFile).toContain("aria-label='Открыть калькулятор'");
    expect(railFile).toContain("aria-label='Выйти из кабинета'");
    expect(railFile).toContain('.p7-mobile-action-logout');
  });

  it('keeps compact mobile header height', () => {
    expect(layoutFile).toContain('.pc-v4-header{min-block-size:58px!important;max-block-size:64px!important}');
    expect(layoutFile).toContain('.pc-v4-header-inner{position:relative!important;overflow:visible!important;padding:8px!important;min-block-size:56px!important;max-block-size:60px!important}');
    expect(layoutFile).not.toContain('padding:calc(env(safe-area-inset-top) + 7px) 8px!important');
  });
});
