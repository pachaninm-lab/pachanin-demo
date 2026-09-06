import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

const home = read('components/platform-v7/PlatformV7StrategicHome.tsx');
const how = read('app/platform-v7/how-it-works/page.tsx');
const trust = read('app/platform-v7/trust/page.tsx');
const about = read('app/platform-v7/about/page.tsx');
const ai = read('app/platform-v7/ai-in-action/page.tsx');
const contactHeader = read('components/platform-v7/ContactFixedHeader.tsx');
const privacy = read('app/platform-v7/privacy/page.tsx');
const privacyPortal = read('components/platform-v7/PrivacyPortalPanel.tsx');
const login = read('app/platform-v7/login/page.tsx');
const register = read('app/platform-v7/register/page.tsx');

describe('platform-v7 linked public shell unification', () => {
  it('uses the canonical public header across the main linked public surfaces', () => {
    for (const source of [home, how, trust, about, ai, contactHeader, privacy, login, register]) {
      expect(source).toContain('PublicSiteHeader');
    }

    for (const source of [how, about, ai, contactHeader, privacy, login, register]) {
      expect(source).toContain('showMobileMenu');
    }

    expect(contactHeader).toContain('PublicLocaleLink');
    expect(privacy).toContain('PublicLocaleLink');
    expect(login).toContain('PublicLocaleLink');
    expect(register).toContain("className='pc-site-locale-switch'");
  });

  it('keeps registration and login routes explicit while preserving registration verification tokens', () => {
    expect(login).toContain("href={`/platform-v7/register${suffix}`}");
    expect(register).toContain("href={`/platform-v7/login${suffix}`}");
    expect(register).toContain("const verifyToken = String(first(params.verify)");
    expect(register).toContain("const statusToken = String(first(params.statusToken)");
    expect(register).toContain("if (verifyToken) localeQuery.set('verify', verifyToken);");
    expect(register).toContain("if (statusToken) localeQuery.set('statusToken', statusToken);");
    expect(register).toContain('verifyToken={verifyToken || undefined}');
    expect(register).toContain('initialStatusToken={statusToken || undefined}');
  });

  it('removes the public service-status route from the unified explanatory pages', () => {
    for (const source of [home, how, trust, about, ai, contactHeader, privacy]) {
      expect(source).not.toContain("href={localizedHref('/platform-v7/status')}");
      expect(source).not.toContain("path: '/platform-v7/status'");
      expect(source).not.toContain("href='/platform-v7/status'");
    }

    expect(how).toContain("href={localizedHref('/platform-v7/trust')}");
    expect(privacy).toContain("path: '/platform-v7/trust'");
    expect(contactHeader).toContain("href={`/platform-v7/trust${suffix}`}");
  });

  it('keeps privacy public, multilingual and detached from protected profile/auth navigation', () => {
    expect(privacy).toContain('export async function generateMetadata');
    expect(privacy).toContain("ru: '/platform-v7/privacy?lang=ru'");
    expect(privacy).toContain("en: '/platform-v7/privacy?lang=en'");
    expect(privacy).toContain("zh: '/platform-v7/privacy?lang=zh'");
    expect(privacy).toContain("title: 'Data categories'");
    expect(privacy).toContain("title: '使用哪些数据'");
    expect(privacy).not.toContain("path: '/platform-v7/profile'");
    expect(privacy).not.toContain("path: '/platform-v7/auth'");
    expect(privacy).not.toContain("path: '/platform-v7/security'");
  });

  it('localizes the data-subject portal and keeps its tabs keyboard complete', () => {
    expect(privacyPortal).toContain("import { useLocale } from 'next-intl';");
    expect(privacyPortal).toContain("title: 'Data-subject rights'");
    expect(privacyPortal).toContain("title: '数据主体权利'");
    expect(privacyPortal).toContain("role='tablist'");
    expect(privacyPortal).toContain("role='tab'");
    expect(privacyPortal).toContain("role='tabpanel'");
    expect(privacyPortal).toContain("case 'ArrowRight'");
    expect(privacyPortal).toContain("case 'ArrowLeft'");
    expect(privacyPortal).toContain("case 'Home'");
    expect(privacyPortal).toContain("case 'End'");
    expect(privacyPortal).not.toContain('неподтверждённый статус');
    expect(privacyPortal).not.toContain('unconfirmed status');
  });

  it('keeps touch-sized primary header controls on the new shell surfaces', () => {
    expect(contactHeader).toContain('min-height:44px');
    expect(privacy).toContain('min-height:44px');
    expect(register).toContain('min-height:44px');
    expect(login).toContain("className='pc-v6-header-cta'");
  });
});
