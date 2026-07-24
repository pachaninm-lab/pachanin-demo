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
  const homeCss = read('styles/platform-v7-strategic-home-v3.css');
  const rootLayout = read('app/layout.tsx');
  const rootLoading = read('app/loading.tsx');
  const publicAuthorityPage = read('app/pc-public-entry/platform-v7/page.tsx');
  const acceptanceConfig = read('playwright.acceptance.config.ts');
  const lighthouseConfig = read('lighthouserc.cjs');
  const lighthouseWorkflow = read('../../.github/workflows/platform-v7-strategic-home-lighthouse.yml');
  const lighthouseSummary = read('../../scripts/platform-v7-lighthouse-summary.mjs');
  const scopeManifest = JSON.parse(read('../../docs/platform-v7/autopilot/scopes/platform-v7-strategic-rebuild-v3.json')) as {
    acceptanceEvidence?: {
      viewports?: number[];
      locales?: string[];
      browsers?: string[];
      lighthouseModes?: string[];
      lighthouseRunsPerMode?: number;
      lighthouseEvidenceClass?: string;
      requiredBoundaries?: string[];
    };
  };

  it('keeps a stable Deal cockpit locator and keyboard-focusable lifecycle', () => {
    expect(home).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(home).toContain("className='pc-v6-lifecycle' role='list' tabIndex={0}");
    expect(home).toContain('aria-label={copy.lifecycle.title}');
    expect(homeCss).toContain('.pc-v6-lifecycle:focus-visible');
    expect(homeCss).toMatch(/\.pc-v6-page\{[^}]*overflow-x:clip/);
  });

  it('mounts the organization request form without fake submission success', () => {
    expect(home).toContain('<OrganizationConnectForm locale={locale} />');
    expect(home).toContain("href='#connect-organization'");
    expect(form).toContain('window.location.assign(`/platform-v7/register?entry=organization-connect');
    expect(form).not.toContain('setTimeout');
    expect(form).not.toContain('fake_success');
  });

  it('separates form-open analytics from a validated organization request', () => {
    expect(home).toContain("eventName='open_organization_connect'");
    expect(home).not.toContain("eventName='submit_organization_request'");
    expect(form).toContain("name: 'submit_organization_request'");
    expect(form).toContain("mode: 'staged_client_validation'");
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

    expect(rootLoading).toContain('<noscript>');
    expect(rootLoading).toContain('Без JavaScript персональные данные здесь не собираются и не передаются');
    expect(rootLoading).toContain('/platform-v7/register?entry=organization-connect&lang=ru');
    expect(rootLoading).toContain('/platform-v7/register?entry=organization-connect&lang=en');
    expect(rootLoading).toContain('/platform-v7/register?entry=organization-connect&lang=zh');
    expect(rootLoading).toContain("href='tel:+79162778989'");
    expect(rootLoading).not.toContain('<form');
    expect(rootLoading).not.toContain('<input');
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

  it('runs the strategic browser spec and keeps acceptance evidence machine-readable', () => {
    expect(acceptanceConfig).toContain('strategic-home-v3');
    expect(scopeManifest.acceptanceEvidence?.viewports).toEqual([320, 375, 390, 430, 768, 1280, 1440]);
    expect(scopeManifest.acceptanceEvidence?.locales).toEqual(['ru', 'en', 'zh']);
    expect(scopeManifest.acceptanceEvidence?.browsers).toEqual(['chromium', 'firefox', 'webkit']);
    expect(scopeManifest.acceptanceEvidence?.requiredBoundaries).toContain('no-JavaScript intake fails closed');
  });

  it('emits SEO metadata on the actual public authority route', () => {
    expect(publicAuthorityPage).toContain('export const metadata: Metadata =');
    expect(publicAuthorityPage).toContain("description: 'Единый цифровой контур Сделки:");
    expect(publicAuthorityPage).toContain("canonical: '/platform-v7'");
    expect(publicAuthorityPage).toContain("ru: '/platform-v7?lang=ru'");
    expect(publicAuthorityPage).toContain("en: '/platform-v7?lang=en'");
    expect(publicAuthorityPage).toContain("zh: '/platform-v7?lang=zh'");
    expect(publicAuthorityPage).toContain('index: true');
    expect(publicAuthorityPage).toContain('follow: true');

    expect(rootLayout).toContain('const PLATFORM_V7_DESCRIPTION =');
    expect(rootLayout).toContain("pathname === '/platform-v7' || pathname === '/pc-public-entry/platform-v7'");
    expect(rootLayout).toContain("<meta name='description' content={pageDescription} />");
  });

  it('preserves root service-worker recovery and analytics bootstrap while injecting metadata', () => {
    expect(rootLayout).toContain("tasks.push(caches.keys().then(function(keys){return Promise.all(keys.map(function(key){return caches.delete(key);}));}));}}catch(e){}");
    expect(rootLayout).toContain("k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})");
    expect(rootLayout).not.toContain("k=e.createElement(t),a=e.getElementsByTagName(t)[0];k.async");
    expect(scopeManifest.acceptanceEvidence?.requiredBoundaries).toContain('root metadata injection preserves service worker recovery and analytics bootstrap scripts byte-for-byte');
  });

  it('collects pinned private Lighthouse evidence without presenting it as live VPS proof', () => {
    expect(lighthouseWorkflow).toContain('pnpm dlx @lhci/cli@0.15.1 autorun');
    expect(lighthouseWorkflow).toContain('matrix:');
    expect(lighthouseWorkflow).toContain('mode: [mobile, desktop]');
    expect(lighthouseWorkflow).toContain('actions/upload-artifact@v4');
    expect(lighthouseWorkflow).not.toContain('temporary-public-storage');
    expect(lighthouseWorkflow).not.toContain('netlify');
    expect(lighthouseWorkflow).not.toContain('vercel');

    expect(lighthouseConfig).toContain("target: 'filesystem'");
    expect(lighthouseConfig).toContain('numberOfRuns: 3');
    expect(lighthouseConfig).toContain("url: ['http://127.0.0.1:3000/platform-v7?lang=ru']");
    expect(lighthouseConfig).toContain("'categories:performance': ['error', { minScore: 0.85");
    expect(lighthouseConfig).toContain("'categories:accessibility': ['error', { minScore: 0.95");
    expect(lighthouseConfig).toContain("'categories:seo': ['error', { minScore: 0.95");
    expect(lighthouseConfig).toContain("'largest-contentful-paint': ['error', { maxNumericValue: 3000");
    expect(lighthouseConfig).toContain("'cumulative-layout-shift': ['error', { maxNumericValue: 0.05");

    expect(lighthouseSummary).toContain('function isReportCandidate');
    expect(lighthouseSummary).toContain("source: 'local-production-build'");
    expect(lighthouseSummary).toContain('productionEvidence: false');
    expect(scopeManifest.acceptanceEvidence?.lighthouseModes).toEqual(['mobile', 'desktop']);
    expect(scopeManifest.acceptanceEvidence?.lighthouseRunsPerMode).toBe(3);
    expect(scopeManifest.acceptanceEvidence?.lighthouseEvidenceClass).toBe('local-production-build-not-live-vps');
  });
});
