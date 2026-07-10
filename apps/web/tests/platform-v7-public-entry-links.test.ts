import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const PUBLIC_ROOT = 'apps/web/app/(platform-public)/platform-v7';

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function exists(relativePath: string) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

describe('platform-v7 public entry contract', () => {
  const landing = read(`${PUBLIC_ROOT}/page.tsx`);
  const login = read(`${PUBLIC_ROOT}/login/page.tsx`);
  const publicHeader = read('apps/web/components/platform-v7/PublicSiteHeader.tsx');
  const localeSwitch = read('apps/web/components/platform-v7/PublicLocaleSwitcher.tsx');
  const publicLayout = read(`${PUBLIC_ROOT}/layout.tsx`);

  it('physically isolates public entry routes from the legacy platform layout', () => {
    expect(exists('apps/web/app/platform-v7/page.tsx')).toBe(false);
    expect(exists('apps/web/app/platform-v7/login/page.tsx')).toBe(false);
    expect(publicLayout).toContain('<PublicSupportWidget />');
    expect(publicLayout).not.toContain('PlatformV7TemplateGuards');
    expect(publicLayout).not.toContain('PlatformV7ShellSwitch');
  });

  it('keeps the public entry free of direct cabinet actions', () => {
    const forbidden = [
      '/platform-v7/seller/batches/new',
      '/platform-v7/buyer/rfq/new',
      'Выставить партию',
      'Создать запрос на закупку',
    ];
    expect(forbidden.filter((snippet) => landing.includes(snippet))).toEqual([]);
  });

  it('never asks a public user to select a role through the URL', () => {
    expect(landing).not.toContain('/platform-v7/login?role=');
    expect(landing).not.toContain('?role=');
    expect(login).not.toContain('useSearchParams');
    expect(login).not.toContain('role=');
    expect(landing).toContain("<article key={key} className={styles.roleTile}>");
  });

  it('keeps exactly two hero actions', () => {
    expect(landing).toContain("href='/platform-v7/register' className={styles.primaryCta}");
    expect(landing).toContain("href='/platform-v7/deal-flow' className={styles.secondaryCta}");
    expect(landing).not.toContain("t('hero.questionCta')");
  });

  it('uses one canonical brand header on landing and login', () => {
    expect(landing).toContain('<PublicSiteHeader');
    expect(login).toContain('<PublicSiteHeader');
    expect(login).not.toContain('<Wheat');
    expect(publicHeader).toContain("import { BrandMark }");
    expect(publicHeader).toContain('<PublicLocaleSwitcher />');
    expect(publicHeader).not.toContain('<style>');
  });

  it('renders the public locale switch without DOM translation patches', () => {
    expect(localeSwitch).not.toContain('MutationObserver');
    expect(localeSwitch).not.toContain('createPortal');
    expect(localeSwitch).not.toContain('applyTranslationToDom');
    expect(localeSwitch).not.toContain('localStorage');
    expect(localeSwitch).not.toContain('document.');
    expect(localeSwitch).toContain("params.set('lang', next)");
  });

  it('uses CSS modules instead of page-level runtime style injection', () => {
    expect(landing).toContain("public-entry.module.css");
    expect(login).toContain("login.module.css");
    expect(landing).not.toContain('<style>');
    expect(login).not.toContain('<style');
  });
});
