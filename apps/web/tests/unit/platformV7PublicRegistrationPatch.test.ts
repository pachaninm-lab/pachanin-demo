import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/page.tsx'), 'utf8');
const login = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/login/page.tsx'), 'utf8');
const forgot = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/forgot-password/page.tsx'), 'utf8');
const shellSwitch = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/PlatformV7ShellSwitch.tsx'), 'utf8');
const guards = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/PlatformV7TemplateGuards.tsx'), 'utf8');
const localeSwitch = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/PublicLocaleSwitch.tsx'), 'utf8');

describe('platform-v7 public registration and single-entry login', () => {
  it('keeps registration as a public organisation-onboarding route', () => {
    expect(page).toContain("href='/platform-v7/register'");
    expect(page).toContain("className='entry-header-register'");
    expect(page).toContain("className='entry-primary-cta'");
  });

  it('does not derive a workspace role from a public URL', () => {
    expect(page).not.toContain('/platform-v7/login?role=');
    expect(login).not.toContain('useSearchParams');
    expect(login).not.toContain('workspace-picker');
    expect(login).not.toContain('pending_role');
    expect(login).toContain("body: JSON.stringify(sessionBody)");
    expect(login).toContain("const sessionBody = payload?.demo === true ? { role } : {};");
  });

  it('uses the canonical public header and next-intl on login', () => {
    expect(login).toContain('PublicSiteHeader');
    expect(login).toContain("useTranslations('publicEntry.login')");
    expect(login).not.toContain('const copy =');
    expect(login).not.toContain('localStorage');
    expect(login).toContain("href='/platform-v7/forgot-password'");
  });

  it('provides a dedicated non-enumerating access recovery flow', () => {
    expect(forgot).toContain("useTranslations('publicEntry.forgot')");
    expect(forgot).toContain("fetch('/api/platform-v7/inquiries'");
    expect(forgot).toContain("payload?.accepted !== true");
    expect(forgot).toContain('PublicSiteHeader');
    expect(forgot).not.toContain('accountExists');
  });

  it('keeps login and recovery outside the protected role shell', () => {
    expect(shellSwitch).toContain("'/platform-v7/forgot-password'");
    expect(shellSwitch).toContain('if (isPublicPath(pathname)) return <>{children}</>;');
    expect(guards).toContain("'/platform-v7/forgot-password'");
  });

  it('switches public locale through next-intl without DOM translation', () => {
    expect(localeSwitch).toContain('useLocale');
    expect(localeSwitch).toContain('useTranslations');
    expect(localeSwitch).toContain("url.searchParams.set('lang', next)");
    expect(localeSwitch).not.toContain('MutationObserver');
    expect(localeSwitch).not.toContain('TreeWalker');
    expect(localeSwitch).not.toContain('applyTranslationToDom');
  });
});
