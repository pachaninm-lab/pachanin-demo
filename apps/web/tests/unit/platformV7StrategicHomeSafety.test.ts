import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 strategic homepage safety and accessibility contract', () => {
  const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const form = read('components/platform-v7/OrganizationConnectForm.tsx');
  const formCss = read('components/platform-v7/OrganizationConnectForm.module.css');
  const formCopy = read('i18n/platform-v7-organization-connect.ts');
  const roleScenario = read('components/platform-v7/PublicDealRoleScenario.tsx');
  const roleScenarioCss = read('components/platform-v7/PublicDealRoleScenario.module.css');

  it('mounts the organization request form without fake submission success', () => {
    expect(home).toContain('<OrganizationConnectForm locale={locale} />');
    expect(home).toContain("href='#connect-organization'");
    expect(form).toContain('window.location.assign(`/platform-v7/register?entry=organization-connect');
    expect(form).not.toContain('setTimeout');
    expect(form).not.toContain('fake_success');
  });

  it('fails closed without JavaScript so personal data cannot enter a URL or unverified channel', () => {
    expect(form).toContain('const [ready, setReady] = useState(false)');
    expect(form).toContain('useEffect(() =>');
    expect(form).toContain('disabled={!ready}');
    expect(form).toContain("data-ready={ready ? 'true' : 'false'}");
    expect(form).toContain('<noscript>');
    expect(form).toContain('copy.jsRequired');
    expect(form).toContain('copy.protectedContinue');
    expect(formCopy).toContain('персональные данные не попали в URL');
  });

  it('does not persist or transmit public form personal data from the staged client boundary', () => {
    expect(form).not.toContain('localStorage');
    expect(form).not.toContain('sessionStorage');
    expect(form).not.toContain('indexedDB');
    expect(form).not.toContain('fetch(');
    expect(form).not.toContain('XMLHttpRequest');
    expect(form).toContain("mode: 'staged_client_validation'");
  });

  it('keeps browser validation, consent and accessible error reporting active', () => {
    expect(form).toContain('form.checkValidity()');
    expect(form).toContain('form.reportValidity()');
    expect(form).toContain("type='checkbox' required");
    expect(form).toContain("role='alert'");
    expect(form).toContain("autoComplete='organization'");
    expect(form).toContain("autoComplete='email'");
    expect(form).toContain("autoComplete='tel'");
  });

  it('keeps RU EN ZH form copy complete and avoids locale inheritance', () => {
    expect(formCopy).toContain('const ru: OrganizationConnectCopy =');
    expect(formCopy).toContain('const en: OrganizationConnectCopy =');
    expect(formCopy).toContain('const zh: OrganizationConnectCopy =');
    expect(formCopy).not.toContain('...ru');
    expect(formCopy).toContain("locale === 'en' ? en : locale === 'zh' ? zh : ru");
  });

  it('keeps participant perspective informational and non-authoritative', () => {
    expect(roleScenario).toContain("role='tablist'");
    expect(roleScenario).toContain("role='tab'");
    expect(roleScenario).toContain('aria-selected={role === key}');
    expect(roleScenario).toContain("role='tabpanel'");
    expect(roleScenario).toContain("aria-live='polite'");
    expect(roleScenario).toContain('не изменяет RBAC');
    expect(roleScenario).not.toContain('accessToken');
    expect(roleScenario).not.toContain('tenantId');
    expect(roleScenario).not.toContain('fetch(');
  });

  it('preserves mobile-first touch targets, horizontal role navigation and reduced motion', () => {
    expect(formCss).toMatch(/min-height:\s*48px/);
    expect(formCss).toContain(':focus-visible');
    expect(formCss).toMatch(/@media\s*\(min-width:\s*760px\)/);
    expect(formCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(roleScenarioCss).toMatch(/min-height:\s*44px/);
    expect(roleScenarioCss).toMatch(/overflow-x:\s*auto/);
    expect(roleScenarioCss).toMatch(/scroll-snap-type:\s*x\s+(?:proximity|mandatory)/);
    expect(roleScenarioCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });
});
