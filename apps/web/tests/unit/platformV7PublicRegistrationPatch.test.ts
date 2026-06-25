import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const template = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/template.tsx'), 'utf8');
const patch = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PublicRegistrationEntryPatch.tsx'), 'utf8');
const cleanup = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PublicEntryCleanup.tsx'), 'utf8');
const login = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/login/page.tsx'), 'utf8');

describe('platform-v7 public registration and role-locked login', () => {
  it('mounts a registration patch on platform-v7 public pages', () => {
    expect(template).toContain('PublicRegistrationEntryPatch');
    expect(template).toContain('<PublicRegistrationEntryPatch />');
  });

  it('keeps public registration visible without turning role cards into registration links', () => {
    expect(patch).toContain("headerLink.href = '/platform-v7/register';");
    expect(patch).toContain("headerLink.textContent = 'Регистрация';");
    expect(patch).toContain("heroLink.href = '/platform-v7/register';");
    expect(patch).toContain("heroLink.textContent = 'Зарегистрироваться';");
    expect(patch).toContain('tile.href = `/platform-v7/login?role=${role}`;');
    expect(patch).toContain("cta.textContent = 'Продолжить вход в этот ЛК';");
    expect(patch).not.toContain('tile.href = `/platform-v7/register?role=${role}`;');
  });

  it('preserves role query parameters from the main role grid', () => {
    expect(cleanup).toContain('const ROLE_BY_TITLE = {');
    expect(cleanup).toContain("'Оператор': 'operator'");
    expect(cleanup).toContain('return role ? `/platform-v7/login?role=${role}` : \'/platform-v7/login\';');
    expect(cleanup).toContain("href.startsWith('/platform-v7/login?')");
    expect(cleanup).toContain('applyRoleLoginHandoff(entry);');
    expect(cleanup).not.toContain("item.setAttribute('href', '/platform-v7/login');");
  });

  it('does not expose a role selector on the login page', () => {
    expect(login).toContain('function readLockedRole(): PlatformRole | null');
    expect(login).toContain("new URLSearchParams(window.location.search).get('role')");
    expect(login).toContain("window.sessionStorage?.getItem(PLATFORM_V7_PENDING_ROLE_KEY)");
    expect(login).toContain('Сначала выбери рабочее место на главной странице. На входе роль повторно не выбирается.');
    expect(login).toContain("<Link href={registerHref} className='login-register'>Зарегистрироваться</Link>");
    expect(login).not.toContain('<select');
    expect(login).not.toContain('onChange={(event) => { setRole');
  });
});
