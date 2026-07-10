import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const appLayout = read('apps/web/app/platform-v7/layout.tsx');
const shellSwitch = read('apps/web/components/platform-v7/PlatformV7ShellSwitch.tsx');
const protectedShell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');
const shellUx = read('apps/web/components/platform-v7/PlatformV7ShellUxController.tsx');
const supportHeader = read('apps/web/components/platform-v7/SupportHeaderIcon.tsx');
const entryFixCss = read('apps/web/styles/platform-v7-entry-fix.css');
const shellRoutes = read('apps/web/lib/platform-v7/shellRoutes.ts');
const statusPage = read('apps/web/app/platform-v7/status/page.tsx');
const loginPage = read('apps/web/app/platform-v7/login/page.tsx');

describe('platform-v7 final shell static gate', () => {
  it('keeps public routes outside the protected shell chunk', () => {
    expect(appLayout).toContain('<PlatformV7ShellSwitch>{children}</PlatformV7ShellSwitch>');
    expect(shellSwitch).toContain("dynamic(");
    expect(shellSwitch).toContain("PlatformV7ProtectedShell");
    expect(shellSwitch).toContain("'/platform-v7/login'");
    expect(shellSwitch).toContain("'/platform-v7/forgot-password'");
    expect(shellSwitch).toContain('if (isPublicPath(pathname)) return <>{children}</>');
    expect(shellSwitch).not.toContain('AppShellV4');
  });

  it('keeps all protected utilities inside the protected shell', () => {
    expect(protectedShell).toContain('<AppShellV4 initialRole={initialRole}>');
    expect(protectedShell).toContain('<PlatformV7SingleEntryGuard />');
    expect(protectedShell).toContain('<PlatformV7ShellUxController />');
    expect(protectedShell).toContain('<RbacCabinetGuard />');
    expect(protectedShell).toContain('<HeaderLanguageSwitch />');
    expect(protectedShell).toContain('<CalculatorHeaderWidget />');
    expect(protectedShell).toContain('<NotepadHeaderWidget />');
    expect(protectedShell).toContain('<SupportHeaderIcon />');
    expect(protectedShell).toContain('<RoleAssistantWidget />');
    expect(protectedShell).not.toContain('<CommandPalette />');
  });

  it('keeps the correct role dock visible and legacy bottom navigation hidden', () => {
    for (const source of [supportHeader, entryFixCss, shellUx]) {
      expect(source).toContain('pc-v4-bottomnav');
      expect(source).toContain('display:none!important');
      expect(source).not.toContain('.pc-v4-bottomnav{display:block!important');
      expect(source).not.toContain('.pc-v7-role-dock{display:none!important');
    }
    expect(supportHeader).toContain('.pc-v7-role-dock{display:block!important');
    expect(entryFixCss).toContain('html body .pc-v7-role-dock{display:block!important');
  });

  it('keeps each role bottom navigation capped and free of utility routes', () => {
    const bottomBlocks = shellRoutes.match(/bottom: \[[\s\S]*?\],\n    drawer:/g) ?? [];
    expect(bottomBlocks.length).toBe(12);
    for (const block of bottomBlocks) {
      expect(block.match(/href:/g)?.length ?? 0).toBeLessThanOrEqual(5);
      expect(block).not.toContain('PLATFORM_V7_AI_ROUTE');
      expect(block).not.toContain('/platform-v7/ai');
      expect(block).not.toContain('Выйти');
    }
  });

  it('keeps status wording aligned with pre-integration maturity', () => {
    expect(statusPage).toContain('Controlled-pilot / pre-integration');
    expect(statusPage).toContain('Требует проверки');
    expect(statusPage).not.toContain('99.4%');
    expect(statusPage).not.toContain('проходят штатно');
    expect(statusPage).not.toContain('уже встроены в платформу');
  });

  it('keeps login free of client-side role authority', () => {
    expect(loginPage).toContain("requestJson('/api/auth/login'");
    expect(loginPage).toContain("requestJson('/api/auth/mfa-login'");
    expect(loginPage).not.toContain('usePlatformV7RStore');
    expect(loginPage).not.toContain('PLATFORM_V7_ACTIVE_ROLE_KEY');
    expect(loginPage).not.toContain('/api/platform-v7/cabinet-session');
    expect(loginPage).not.toContain('sessionStorage');
  });
});
