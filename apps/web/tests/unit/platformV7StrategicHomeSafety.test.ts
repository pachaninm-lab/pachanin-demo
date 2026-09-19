import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { PublicDealExecutionStates } from '../../components/platform-v7/PublicDealRoleScenario';
import { getOrganizationConnectCopy } from '../../i18n/platform-v7-organization-connect-product';
import { sanitizePublicProductAnalyticsDetail } from '../../lib/analytics/analytics-boundary';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('platform-v7 strategic homepage safety and accessibility contract', () => {
  it.each([
    ['ru', 'Нужна помощь перед регистрацией?', 'Обращение не создаёт аккаунт и не предоставляет доступ к платформе.'],
    ['en', 'Need help before registration?', 'An inquiry does not create an account or provide platform access.'],
    ['zh', '注册前需要帮助？', '提交咨询不会创建账户，也不会授予平台访问权限。'],
  ])('resolves pre-registration help through the actual runtime alias in %s', (locale, title, boundary) => {
    const copy = getOrganizationConnectCopy(locale);
    const paths = JSON.parse(read('tsconfig.json')).compilerOptions.paths;
    expect(paths['@/i18n/platform-v7-organization-connect']).toEqual(['./i18n/platform-v7-organization-connect-product.ts']);
    expect(copy.title).toBe(title);
    expect(copy.lead).toContain(boundary);
  });
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
  const scopeManifest = JSON.parse(read('../../docs/platform-v7/autopilot/scopes/platform-v7-strategic-rebuild-v3.json')) as {
    schemaVersion?: string;
    branch?: string;
    allowedPaths?: string[];
    forbiddenChanges?: string[];
  };

  it('keeps a stable public locator and keyboard-focusable final journey without masking overflow', () => {
    expect(home).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(home).toContain("className='pc-final-carousel' tabIndex={0} role='region'");
    expect(home).toContain("className='pc-final-stages' tabIndex={0} aria-labelledby='journey-title'");
    expect(home).toContain("<details className='pc-final-role-explorer'>");
    expect(home).toContain('<summary>{copy.participants.explorerTitle}</summary>');
    expect(homeCss).toContain('.pc-final-role-explorer>summary{min-height:44px');
    expect(home).toContain('<PublicDealExecutionStates title={copy.execution.title}');
    expect(home).toContain('states={copy.execution.states}');
    expect(home).toContain("<svg");
    expect(home).toContain("className='pc-final-hero-image'");
    expect(home).toContain("aria-label={label}");
    expect(home).toContain("preserveAspectRatio='xMidYMid slice'");
    expect(home).toContain("<HeroGrainIllustration label={copy.hero.visualAlt} />");
    expect(home).toContain("const FINAL_HERO_CRITICAL_CSS = "+String.fromCharCode(96));
    expect(home).toContain("<style>{FINAL_HERO_CRITICAL_CSS}</style>");
    expect(home).toContain(".pc-v7-public-entry .pc-final-hero-copy h1{margin:14px 0 0");
    expect(home).toContain("@media(max-width:767px){.pc-v7-public-entry .pc-final-shell");
    expect(home).not.toContain("data:image/svg+xml;base64,");
    expect(home).not.toContain("<img className='pc-final-hero-image'");
    expect(home).not.toContain("<feGaussianBlur");
    expect(homeCss).toContain('.pc-final-state-tabs button:focus-visible');
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
    expect(home).toContain('function registerHref(locale: Locale, intent?: string)');
    expect(home).toContain("eventName='registration_open'");
    expect(home).toContain("className='pc-final-help-link' href='#connect-organization'");
    expect(home).toContain('<OrganizationConnectForm locale={locale} />');
    expect(formOperatingCopy).toContain('Обращение не создаёт аккаунт и не предоставляет доступ к платформе');
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

  it('preserves sell and buy intent through the existing privacy-safe analytics boundary', () => {
    const entries = [...home.matchAll(/params=\{\{ source: '([^']+)', option: '([^']+)', role_entry: '([^']+)' \}\}/g)];
    expect(entries.map(([, source, option, role]) => [source, option, role])).toEqual([
      ['public_v5_intent', 'sell', 'seller'], ['public_v5_intent', 'buy', 'buyer'],
      ['public_v5_complete', 'sell', 'seller'], ['public_v5_complete', 'buy', 'buyer'],
    ]);
    for (const [, source, option, role_entry] of entries) {
      expect(sanitizePublicProductAnalyticsDetail({ name: 'registration_open', source, option, role_entry,
        email: 'private@example.invalid', form_text: 'private form text', url: '?token=private' }))
        .toEqual({ name: 'registration_open', properties: { source, option, role_entry } });
    }
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
    expect(scopeManifest.branch).toBe('agent/platform-v7-strategic-rebuild-v3');
    expect(scopeManifest.allowedPaths).toContain('apps/web/components/platform-v7/PlatformV7StrategicHome.tsx');
    expect(scopeManifest.allowedPaths).toContain('apps/web/components/platform-v7/PublicDealRoleScenario.tsx');
    expect(scopeManifest.allowedPaths).toContain('apps/web/i18n/platform-v7-organization-connect.ts');
    expect(scopeManifest.allowedPaths).toHaveLength(30);
    expect(scopeManifest.allowedPaths?.some((path) => path.startsWith('apps/api/') || path.startsWith('apps/web/app/platform-v7/register/'))).toBe(false);
    expect(scopeManifest.allowedPaths).not.toContain('docs/platform-v7/autopilot/scopes/platform-v7-strategic-rebuild-v3.json');
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


describe('public execution state keyboard interaction', () => {
  it('links selected tabs to panels and supports arrows, Home and End without granting an action', () => {
    const states = ['normal', 'deviation', 'dispute'].map((key) => ({ key, tab: key, happened: key, owner: 'participant', money: 'basis', next: 'review' }));
    const view = render(createElement(PublicDealExecutionStates, { title: 'Execution', states, labels: { happened: 'Fact', owner: 'Who', money: 'Money', next: 'Next' } }));
    try {
      const tabs = view.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
      expect(view.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', tabs[0].id);
      tabs[0].focus();
      fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
      expect(tabs[1]).toHaveFocus();
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[0]).toHaveAttribute('tabindex', '-1');
      expect(view.getByRole('tabpanel')).toHaveAttribute('id', tabs[1].getAttribute('aria-controls'));
      fireEvent.keyDown(tabs[1], { key: 'End' });
      expect(tabs[2]).toHaveFocus();
      fireEvent.keyDown(tabs[2], { key: 'ArrowRight' });
      expect(tabs[0]).toHaveFocus();
      fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' });
      expect(tabs[2]).toHaveFocus();
      fireEvent.keyDown(tabs[2], { key: 'Home' });
      expect(tabs[0]).toHaveFocus();
      fireEvent.click(tabs[2]);
      expect(view.getByRole('tabpanel')).toHaveTextContent('dispute');
      expect(view.getByRole('tabpanel').querySelector('button,form,a')).toBeNull();
    } finally { cleanup(); }
  });
});
