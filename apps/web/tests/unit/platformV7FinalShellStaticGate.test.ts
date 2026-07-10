import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const appLayout = read('apps/web/app/platform-v7/layout.tsx');
const protectedShell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');
const shellUx = read('apps/web/components/platform-v7/PlatformV7ShellUxController.tsx');
const supportHeader = read('apps/web/components/platform-v7/SupportHeaderIcon.tsx');
const entryFixCss = read('apps/web/styles/platform-v7-entry-fix.css');
const shellRoutes = read('apps/web/lib/platform-v7/shellRoutes.ts');
const statusPage = read('apps/web/app/platform-v7/status/page.tsx');
const loginPage = read('apps/web/app/platform-v7/login/page.tsx');
const loginFlow = read('apps/web/components/platform-v7/PublicAuthLoginFlow.tsx');
const loginRoute = read('apps/web/app/api/auth/login/route.ts');

function roleDockBlock() {
  const start = shellUx.indexOf('<nav className="pc-v7-role-dock"');
  const end = shellUx.indexOf('</nav>', start);
  return shellUx.slice(start, end);
}

function protectedShellBlock(source: string) {
  const start = source.indexOf('<AppShellV4 initialRole=');
  const end = source.indexOf('</AppShellV4>', start);
  return source.slice(start, end);
}

describe('platform-v7 final shell static gate', () => {
  it('keeps public routes outside the protected client graph', () => {
    expect(appLayout).toContain("headers().get('x-pc-pathname')");
    expect(appLayout).not.toContain("import { AppShellV4 }");
    expect(protectedShell).toContain('<AppShellV4 initialRole={initialRole}>');
  });

  it('keeps the protected shell contract intact', () => {
    const shell = protectedShellBlock(protectedShell);
    for (const snippet of [
      '<PlatformV7SingleEntryGuard />',
      '<PlatformV7ShellUxController />',
      '<RbacCabinetGuard />',
      '<CalculatorHeaderWidget />',
      '<NotepadHeaderWidget />',
      '<SupportHeaderIcon />',
      '<RoleAssistantWidget />',
    ]) expect(shell).toContain(snippet);
    expect(protectedShell).not.toContain('<CommandPalette />');
  });

  it('keeps notepad and calculator inside protected shell only', () => {
    const shell = protectedShellBlock(protectedShell);
    expect(shell.indexOf('<CalculatorHeaderWidget />')).toBeLessThan(shell.indexOf('<NotepadHeaderWidget />'));
    expect(shell.indexOf('<NotepadHeaderWidget />')).toBeLessThan(shell.indexOf('<SupportHeaderIcon />'));
    expect(appLayout).not.toContain('CalculatorHeaderWidget');
    expect(appLayout).not.toContain('NotepadHeaderWidget');
  });

  it('keeps the correct role dock visible and the legacy bottom navigation hidden', () => {
    for (const source of [supportHeader, entryFixCss, shellUx]) {
      expect(source).toContain('pc-v4-bottomnav');
      expect(source).toContain('display:none!important');
      expect(source).not.toContain('.pc-v4-bottomnav{display:block!important');
      expect(source).not.toContain('.pc-v7-role-dock{display:none!important');
    }
    expect(supportHeader).toContain('.pc-v7-role-dock{display:block!important');
    expect(entryFixCss).toContain('html body .pc-v7-role-dock{display:block!important');
    expect(shellUx).toContain('.pc-v7-role-dock{position:fixed;left:0;right:0;bottom:0;');
  });

  it('keeps utility actions out of the lower role dock', () => {
    const dock = roleDockBlock();
    expect(dock).toContain('dockLinks.map');
    expect(dock).not.toContain('ИИ');
    expect(dock).not.toContain('Меню');
    expect(dock).not.toContain('LogOut');
    expect(dock).not.toContain('button');
  });

  it('keeps each role bottom navigation capped and free of utility routes', () => {
    const bottomBlocks = shellRoutes.match(/bottom: \[[\s\S]*?\],\n    drawer:/g) ?? [];
    expect(bottomBlocks.length).toBe(12);
    for (const block of bottomBlocks) {
      expect(block.match(/href:/g)?.length ?? 0).toBeLessThanOrEqual(5);
      expect(block).not.toContain('PLATFORM_V7_AI_ROUTE');
      expect(block).not.toContain('/platform-v7/ai');
      expect(block).not.toContain('/platform-v7/roles');
      expect(block).not.toContain('Выйти');
      expect(block).not.toContain('Меню');
    }
  });

  it('keeps mobile header actions from hiding the calculator', () => {
    expect(entryFixCss).toContain('html body .p7-calc-widget{display:inline-flex!important');
    expect(entryFixCss).toContain('order:30!important');
    expect(entryFixCss).toContain('.p7-calc-widget .pc-v4-iconbtn{display:inline-flex!important');
    expect(supportHeader).not.toContain('.p7-calc-widget{display:none');
  });

  it('keeps status wording aligned with unconfirmed external integrations', () => {
    expect(statusPage).toContain('Требует проверки');
    expect(statusPage).not.toContain('99.4%');
    expect(statusPage).not.toContain('97.8%');
    expect(statusPage).not.toContain('проходят штатно');
    expect(statusPage).not.toContain('уже встроены в платформу');
  });

  it('uses server session issuance and redirect instead of client cabinet handoff', () => {
    expect(loginPage).toContain('<PublicAuthLoginFlow />');
    expect(loginFlow).toContain('payload.redirectTo');
    expect(loginFlow).not.toContain('platformV7RoleHome');
    expect(loginFlow).not.toContain("fetch('/api/platform-v7/cabinet-session'");
    expect(loginFlow).not.toContain('document.cookie');
    expect(loginRoute).toContain('applyAuthenticatedSession');
  });
});
