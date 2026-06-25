import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const loginPage = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/login/page.tsx'), 'utf8');

describe('platform-v7 login role handoff', () => {
  it('reads a public role query without using a router search-param bailout', () => {
    expect(loginPage).toContain('readRoleFromPublicEntry');
    expect(loginPage).toContain("new URLSearchParams(window.location.search).get('role')");
    expect(loginPage).not.toContain('useSearchParams');
  });

  it('keeps the selected public role as form context only until login succeeds', () => {
    expect(loginPage).toContain('setRole(publicEntryRole);');
    expect(loginPage).toContain('setRoleFromEntry(true);');
    expect(loginPage).toContain('роль фиксируется на сессию только после входа');
    expect(loginPage).toContain('публичный выбор роли не открывает кабинет');
    expect(loginPage).toContain('globalThis.sessionStorage?.setItem(PLATFORM_V7_ACTIVE_ROLE_KEY, nextRole);');
  });
});
