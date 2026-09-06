import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 strategic homepage safety and accessibility contract', () => {
  const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const form = read('components/platform-v7/OrganizationConnectForm.tsx');
  const formCss = read('components/platform-v7/OrganizationConnectForm.module.css');
  const formBaseCopy = read('i18n/platform-v7-organization-connect.ts');
  const formOperatingCopy = read('i18n/platform-v7-organization-connect-operating.ts');
  const roleScenario = read('components/platform-v7/PublicDealRoleScenario.tsx');
  const roleScenarioCss = read('components/platform-v7/PublicDealRoleScenario.module.css');
  const contactDock = read('components/platform-v7/PublicContactDock.tsx');
  const homeCss = read('styles/platform-v7-strategic-home-v3.css');
  const rootLayout = read('app/layout.tsx');
  const publicAuthorityPage = read('app/platform-v7/page.tsx');
  const scopeManifest = JSON.parse(read('../../docs/platform-v7/autopilot/scopes/public-home-role-clarity-20260905.json')) as {
    schemaVersion?: string;
    branch?: string;
    allowedPaths?: string[];
    forbiddenChanges?: string[];
  };

  it('keeps a stable Deal cockpit locator and keyboard-focusable public journey', () => {
    expect(home).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(home).toContain("className='pc-v6-lifecycle' role='list' tabIndex={0}");
    expect(home).toContain('aria-label={copy.lifecycle.title}');
    expect(homeCss).toContain('.pc-v6-lifecycle:focus-visible');
    expect(homeCss).toMatch(/\.pc-v6-page\s*\{[^}]*overflow-x:\s*clip/);
  });

  it('uses protected registration as primary conversion while keeping durable assistance separate', () => {
    expect(home).toContain('const registerHref = `/platform-v7/register?lang=');
    expect(home).toContain("eventName='registration_open'");
    expect(home).toContain("href='#connect-organization'");
    expect(home).toContain('<OrganizationConnectForm locale={locale} />');
    expect(formOperatingCopy).toContain('Эта форма не является регистрацией');
    expect(formOperatingCopy).toContain("submit: 'Отправить запрос на помощь'");
    expect(form).toContain("fetch('/api/platform-v7/organization-connect'");
    expect(form).toContain("'Idempotency-Key'");
    expect(form).toContain("body.ok !== true");
    expect(form).not.toContain('fake_success');
  });

  it('separates assistance-open, step completion, submission and server acceptance analytics', () => {
    expect(home).toContain("eventName='open_organization_connect'");
    expect(home).not.toContain("eventName='submit_organization_request'");
    expect(form).toContain("name: 'organization_request_step_completed'");
    expect(form).toContain("name: 'submit_organization_request'");
    expect(form).toContain("mode: 'durable_server_intake'");
    expect(form).toContain("name: 'organization_request_accepted'");
  });

  it('fails closed without JavaScript and keeps personal data out of browser storage', () => {
    expect(form).toContain('const [ready, setReady] = useState(false)');
    expect(form).toContain('disabled={!ready || submitting}');
    expect(form).toContain("data-ready={ready ? 'true' : 'false'}");
    expect(form).toContain('<noscript>');
    expect(form).toContain('copy.jsRequired');
    expect(form).toContain('copy.protectedContinue');
    expect(formBaseCopy).toContain('персональные данные не попали в URL');
    expect(form).not.toContain('localStorage');
    expect(form).not.toContain('sessionStorage');
    expect(form).not.toContain('indexedDB');
    expect(form).toContain("method: 'POST'");
    expect(form).toContain("cache: 'no-store'");
    expect(form).toContain('AbortSignal.timeout(10_000)');
  });

  it('keeps progressive validation, consent and accessible error reporting active', () => {
    expect(form).toContain("type Step = 1 | 2");
    expect(form).toContain("const names = ['organizationName', 'inn', 'contactName']");
    expect(form).toContain('field.checkValidity()');
    expect(form).toContain('form.checkValidity()');
    expect(form).toContain('form.reportValidity()');
    expect(form).toContain("type='checkbox' required");
    expect(form).toContain("role='alert'");
    expect(form).toContain("autoComplete='organization'");
    expect(form).toContain("autoComplete='email'");
    expect(form).toContain("autoComplete='tel'");
  });

  it('keeps public role selection informational and non-authoritative', () => {
    expect(roleScenario).toContain("role='tablist'");
    expect(roleScenario).toContain("role='tab'");
    expect(roleScenario).toContain('aria-selected={role === key}');
    expect(roleScenario).toContain("role='tabpanel'");
    expect(roleScenario).toContain("aria-live='polite'");
    expect(roleScenario).toContain('реальные полномочия определяются системой после регистрации и проверки организации');
    expect(roleScenario).not.toContain('accessToken');
    expect(roleScenario).not.toContain('tenantId');
    expect(roleScenario).not.toContain('fetch(');
  });

  it('prevents the contact dock from obscuring content during downward scrolling', () => {
    expect(contactDock).toContain('const [hiddenByScroll, setHiddenByScroll]');
    expect(contactDock).toContain("data-scroll-hidden={hiddenByScroll ? 'true' : 'false'}");
    expect(contactDock).toContain(".pc-public-contact-dock[data-scroll-hidden='true']");
    expect(contactDock).toContain('visibility: hidden');
  });

  it('preserves mobile touch targets, horizontal role navigation and reduced motion', () => {
    expect(formCss).toMatch(/min-height:\s*48px/);
    expect(formCss).toContain(':focus-visible');
    expect(formCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(roleScenarioCss).toMatch(/min-height:\s*44px/);
    expect(roleScenarioCss).toMatch(/overflow-x:\s*auto/);
    expect(roleScenarioCss).toMatch(/scroll-snap-type:\s*x\s+(?:proximity|mandatory)/);
    expect(homeCss).toContain('@media (max-width: 767px)');
  });

  it('binds implementation to the explicit immutable public-home scope', () => {
    expect(scopeManifest.schemaVersion).toBe('platform-v7.concurrent-scope.v1');
    expect(scopeManifest.branch).toBe('feat/public-home-role-clarity-20260905');
    expect(scopeManifest.allowedPaths).toContain('apps/web/components/platform-v7/PlatformV7StrategicHome.tsx');
    expect(scopeManifest.allowedPaths).toContain('apps/web/components/platform-v7/PublicDealRoleScenario.tsx');
    expect(scopeManifest.allowedPaths).toContain('apps/web/components/platform-v7/OrganizationConnectForm.tsx');
    expect(scopeManifest.forbiddenChanges).toContain('apps/web/app/platform-v7/register/**');
    expect(scopeManifest.forbiddenChanges).toContain('apps/api/**');
  });

  it('emits indexable homepage metadata while preserving root recovery bootstrap', () => {
    expect(publicAuthorityPage).toContain('export const metadata: Metadata =');
    expect(publicAuthorityPage).toContain("canonical: '/platform-v7'");
    expect(publicAuthorityPage).toContain("ru: '/platform-v7?lang=ru'");
    expect(publicAuthorityPage).toContain("en: '/platform-v7?lang=en'");
    expect(publicAuthorityPage).toContain("zh: '/platform-v7?lang=zh'");
    expect(publicAuthorityPage).toContain('index: true');
    expect(publicAuthorityPage).toContain('follow: true');
    expect(rootLayout).toContain('const PLATFORM_V7_DESCRIPTION =');
    expect(rootLayout).toContain("pathname === '/platform-v7' || pathname === '/pc-public-entry/platform-v7'");
    expect(rootLayout).toContain("<meta name='description' content={pageDescription} />");
    expect(rootLayout).toContain('tasks.push(caches.keys().then(function(keys){return Promise.all(keys.map(function(key){return caches.delete(key);}));}));}}catch(e){}');
  });
});
