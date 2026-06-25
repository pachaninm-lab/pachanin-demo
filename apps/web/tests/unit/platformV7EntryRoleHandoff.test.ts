import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const publicEntryCleanup = read('apps/web/components/platform-v7/PublicEntryCleanup.tsx');
const loginPage = read('apps/web/app/platform-v7/login/page.tsx');
const registerPage = read('apps/web/app/platform-v7/register/page.tsx');

describe('platform-v7 entry role handoff', () => {
  it('passes role-card selection into the single login route without reopening role choice', () => {
    expect(publicEntryCleanup).toContain('const ROLE_BY_TITLE = {');
    expect(publicEntryCleanup).toContain("'Продавец': 'seller'");
    expect(publicEntryCleanup).toContain("'Банк': 'bank'");
    expect(publicEntryCleanup).toContain("'Руководитель': 'executive'");
    expect(publicEntryCleanup).toContain('function applyRoleLoginHandoff(root: ParentNode)');
    expect(publicEntryCleanup).toContain('link.setAttribute(\'href\', roleLoginHref(title));');
    expect(publicEntryCleanup).toContain('href.startsWith(\'/platform-v7/login?\')');
    expect(publicEntryCleanup).toContain('applyRoleLoginHandoff(entry);');
  });

  it('keeps login role-aware and hides duplicate role selection when a role is already selected', () => {
    expect(loginPage).toContain('function requestedRoleFromUrl(): PlatformRole | null');
    expect(loginPage).toContain("new URLSearchParams(window.location.search).get('role')");
    expect(loginPage).toContain('const [lockedRole, setLockedRole] = React.useState<PlatformRole | null>(initialRole);');
    expect(loginPage).toContain('Роль уже выбрана на главном экране');
    expect(loginPage).toContain('lockedRole ? (');
    expect(loginPage).toContain('login-role-locked');
    expect(loginPage).toContain('<label><span>Рабочее место</span><select value={role}');
    expect(loginPage).toContain('const registerHref = lockedRole ? `/platform-v7/register?role=${lockedRole}` : \'/platform-v7/register\';');
    expect(loginPage).toContain("<Link href={registerHref} className='login-register'>Зарегистрироваться</Link>");
    expect(loginPage).not.toContain('useSearchParams');
  });

  it('opens registration as a real route and preserves the same role context', () => {
    expect(registerPage).toContain('function requestedRoleFromUrl(): RegistrationRole | null');
    expect(registerPage).toContain('const [selectedRole, setSelectedRole] = React.useState<RegistrationRole | null>(initialRole);');
    expect(registerPage).toContain('Повторно выбирать роль не нужно. Заявка и вход сохраняют один и тот же кабинет.');
    expect(registerPage).toContain('const participantFields = selectedRole ? PARTICIPANT_FIELDS.filter');
    expect(registerPage).toContain('const loginHref = selectedRole ? `/platform-v7/login?role=${selectedRole}` : \'/platform-v7/login\';');
    expect(registerPage).toContain('<PremiumCtaButton href={loginHref} variant=\'ghost\'>Уже есть доступ — войти</PremiumCtaButton>');
  });
});
