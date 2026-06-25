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

  it('uses a compact workspace heading after handoff and a chooser only for direct login', () => {
    expect(login).toContain('const [entryRole, setEntryRole]');
    expect(login).toContain('const [directRole, setDirectRole]');
    expect(login).toContain("login-workspace-heading");
    expect(login).toContain("login-workspace-picker");
    expect(login).toContain('Введите корпоративные данные для доступа к рабочему контуру.');
    expect(login).toContain("<Link href={registerHref} className='login-register'>Зарегистрироваться</Link>");
    expect(login).not.toContain('login-selected-missing');
  });
});
