import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 strategic homepage safety and accessibility contract', () => {
  const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
  const form = read('components/platform-v7/OrganizationConnectForm.tsx');
  const formCss = read('components/platform-v7/OrganizationConnectForm.module.css');
  const formBaseCopy = read('i18n/platform-v7-organization-connect.ts');
  const heroCopy = read('i18n/platform-v7-hero-message.ts');
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

  it('keeps a stable public locator and keyboard-focusable final journey without masking overflow', () => {
    expect(home).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(home).toContain("className='pc-final-carousel' tabIndex={0} role='region'");
    expect(home).toContain("type='radio' name='public-final-deal-state'");
    expect(home).toContain("htmlFor={`public-final-state-${state.key}`}");
    expect(home).toContain("loading='eager' fetchPriority='high'");
    expect(home).toContain("const HERO_IMAGE_DATA = 'data:image/svg+xml;base64,");
    expect(home).toContain("src={HERO_IMAGE_DATA}");
    expect(home).toContain("decoding='sync'");
    expect(homeCss).toContain('#public-final-state-normal:focus-visible~.pc-final-state-tabs');
    expect(homeCss).toContain('.pc-final-page :where(a,button,input,select,textarea,summary,[role="tab"]):focus-visible');
    expect(homeCss).not.toContain('overflow-x:clip');
    expect(homeCss).toContain('.pc-final-page .pc-skip-link {');
    expect(homeCss).toContain('.pc-final-page .pc-skip-link:focus-visible { top: 8px; }');
    expect(homeCss).toContain('.pc-final-hero-visual{min-height:120px;border-radius:20px}');
  });

  it('keeps visitor-facing copy free of development-stage and infrastructure vocabulary', () => {
    const visitorCopy = [heroCopy, formBaseCopy, roleScenario].join('\n');
    expect(visitorCopy).not.toMatch(/(?:демо|демонстрац|пилот|прототип|скоро|в разработ|demo|demonstrat|pilot|prototype|coming soon|in development)/i);
    expect(visitorCopy).not.toMatch(/(?:postgresql|\\brls\\b|kafka|outbox|k8s|sbom|qwen|governance|release authority)/i);
  });

  it('uses protected registration as primary conversion while keeping durable assistance separate', () => {
    expect(home).toContain('function registerHref(locale: Locale)');
    expect(home).not.toContain("query.set('intent'");
    expect(home).toContain("eventName='registration_open'");
    expect(home).toContain("className='pc-final-help-link' href='#connect-organization'");
    expect(home).toContain('<OrganizationConnectForm locale={locale} />');
    expect(formOperatingCopy).toContain('Эта форма не является регистрацией');
    expect(formOperatingCopy).toContain("submit: 'Отправить запрос на помощь'");
    expect(form).toContain("fetch('/api/platform-v7/organization-connect'");
    expect(form).toContain("'Idempotency-Key'");
    expect(form).toContain("body.ok !== true");
    expect(form).not.toContain('fake_success');
  });

  it('separates assistance-open, step completion, submission and server acceptance analytics', () => {
    expect(home).toContain("href='#connect-organization'");
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
    expect(form).toContain('.pc-v7-public-entry #connect-organization form{display:none!important}');
    expect(form).toContain('Без JavaScript персональные данные здесь не собираются и не передаются.');
    expect(form).toContain('Without JavaScript, personal data is not collected or transmitted here.');
    expect(form).toContain('未启用 JavaScript 时，此页面不会收集或传输个人数据。');
    for (const locale of ['ru', 'en', 'zh']) {
      expect(form).toContain(`/platform-v7/register?entry=organization-connect&lang=${locale}`);
    }
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
    expect(roleScenario).toContain("label: 'Сотрудник подключённой организации'");
    expect(roleScenario).toContain("label: 'Employee of a connected organisation'");
    expect(roleScenario).toContain("label: '已接入机构员工'");
    for (const retired of ['Сотрудник платформы', 'сотрудник платформы', 'Platform employee', 'platform employee', 'platform staff', '平台员工']) {
      expect(roleScenario).not.toContain(retired);
    }
    expect(roleScenario).not.toContain('accessToken');
    expect(roleScenario).not.toContain('tenantId');
    expect(roleScenario).not.toContain('fetch(');
  });

  it('preserves public Gekta access, private scroll hiding and modal collision protection', () => {
    expect(contactDock).toContain('const [hiddenByScroll, setHiddenByScroll]');
    expect(contactDock).toContain("const scrollHidden = assistantContext === 'public' ? false : hiddenByScroll;");
    expect(contactDock).toContain("data-scroll-hidden={scrollHidden ? 'true' : 'false'}");
    expect(contactDock).toContain('const hidden = dialogOpen || scrollHidden;');
    expect(contactDock).toContain("data-dialog-open={dialogOpen ? 'true' : 'false'}");
    expect(contactDock).toContain('tabIndex={hidden ? -1 : 0}');
    expect(contactDock).toContain('disabled={hidden}');
    expect(contactDock).toContain(".pc-public-contact-dock[data-scroll-hidden='true']");
    expect(contactDock).toContain('visibility: hidden');
  });

  it('preserves mobile touch targets, horizontal role navigation and reduced motion', () => {
    const inputHeight = formCss.match(/\.form input,\s*\.form select\s*\{[^}]*min-height:\s*(\d+)px/);
    const actionHeight = formCss.match(/\.actions button,\s*\.noScript a\s*\{[^}]*min-height:\s*(\d+)px/);
    expect(inputHeight).not.toBeNull();
    expect(actionHeight).not.toBeNull();
    expect(Number(inputHeight?.[1])).toBeGreaterThanOrEqual(48);
    expect(Number(actionHeight?.[1])).toBeGreaterThanOrEqual(48);
    expect(formCss).toContain(':focus-visible');
    expect(formCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(roleScenarioCss).toMatch(/min-height:\s*44px/);
    expect(roleScenarioCss).toMatch(/overflow-x:\s*auto/);
    expect(roleScenarioCss).toMatch(/scroll-snap-type:\s*x\s+(?:proximity|mandatory)/);
    expect(homeCss).toContain('@media(max-width:767px)');
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
    expect(publicAuthorityPage).toContain('export async function generateMetadata(): Promise<Metadata>');
    expect(publicAuthorityPage).toContain('await getLocale()');
    expect(publicAuthorityPage).not.toContain('export const metadata: Metadata');
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
