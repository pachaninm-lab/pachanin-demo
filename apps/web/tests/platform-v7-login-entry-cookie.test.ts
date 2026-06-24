import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const loginPage = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/login/page.tsx'), 'utf8');

describe('platform-v7 login cabinet handoff', () => {
  it('marks the platform-v7 entry gate before opening a cabinet route', () => {
    expect(loginPage).toContain("const PLATFORM_V7_ENTRY_COOKIE = 'pc_v7_entry_seen'");
    expect(loginPage).toContain('function markEntrySeen()');
    expect(loginPage).toContain('document.cookie = `${PLATFORM_V7_ENTRY_COOKIE}=true; Path=/; Max-Age=');
    expect(loginPage).toContain('markEntrySeen();');
    expect(loginPage.indexOf('markEntrySeen();')).toBeLessThan(loginPage.indexOf('router.replace(platformV7RoleHome(nextRole))'));
  });

  it('waits for the cabinet session request before route replacement to avoid middleware race redirects', () => {
    expect(loginPage).toContain('async function openWorkspace(nextRole: PlatformRole)');
    expect(loginPage).toContain("await fetch('/api/platform-v7/cabinet-session'");
    expect(loginPage.indexOf("await fetch('/api/platform-v7/cabinet-session'")).toBeLessThan(loginPage.indexOf('router.replace(platformV7RoleHome(nextRole))'));
  });
});
