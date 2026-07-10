import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const landing = fs.readFileSync(path.join(repoRoot, 'apps/web/app/(platform-public)/platform-v7/page.tsx'), 'utf8');
const login = fs.readFileSync(path.join(repoRoot, 'apps/web/app/(platform-public)/platform-v7/login/page.tsx'), 'utf8');

function count(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

describe('platform-v7 single-entry login', () => {
  it('uses one role-neutral public login destination', () => {
    expect(count(landing, "href='/platform-v7/login'")).toBe(1);
    expect(landing).not.toContain('/platform-v7/login?role=');
    expect(landing).not.toContain("login?role=${role.key}");
  });

  it('keeps role cards informational only', () => {
    expect(landing).toContain("<article key={key} className={styles.roleTile}>");
    expect(landing).not.toContain('login-workspace-picker');
    expect(landing).not.toContain('Выберите один рабочий кабинет');
  });

  it('keeps login free of role selection and role handoff state', () => {
    expect(login).not.toContain('useSearchParams');
    expect(login).not.toContain('requestedRole');
    expect(login).not.toContain('setRole(');
    expect(login).not.toContain('sessionStorage');
    expect(login).not.toContain('role picker');
  });
});
