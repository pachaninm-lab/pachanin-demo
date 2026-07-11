import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('platform-v7 root working entry', () => {
  const page = readFileSync(join(process.cwd(), 'app/platform-v7/page.tsx'), 'utf8');
  const publicMessages = readFileSync(join(process.cwd(), 'i18n/public-entry-messages.ts'), 'utf8');
  const landingCss = readFileSync(join(process.cwd(), 'styles/platform-v7-public-landing.css'), 'utf8');
  const worldClassCss = readFileSync(join(process.cwd(), 'styles/platform-v7-public-world-class.css'), 'utf8');
  const mobileShell = readFileSync(join(process.cwd(), 'styles/platform-v7-mobile-shell-p1.css'), 'utf8');

  it('uses the industrial public execution surface as the root entry', () => {
    expect(page).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(page).toContain("data-maturity='industrial-public-entry'");
    expect(page).toContain('entry-hero');
    expect(page).toContain('entry-role-grid');
    expect(page).toContain('entry-footer');
  });

  it('keeps role discovery non-authoritative and exposes one server-resolved login gate', () => {
    expect(page).toContain("className='entry-role-grid' role='list'");
    expect(page).toContain("<article key={key} className='entry-role-tile' role='listitem'>");
    expect(page).toContain("href='/platform-v7/login' className='entry-role-access-cta'");
    expect(page).not.toContain('/platform-v7/login?role=');
    expect(page).not.toContain("href: '/platform-v7/seller'");
    expect(page).not.toContain("href: '/platform-v7/buyer'");
    expect(page).not.toContain("href: '/platform-v7/bank'");
    expect(page).not.toContain("<a key={key} href={href} className='entry-role-tile'");
    expect(publicMessages).toContain('Роль не выбирается вручную');
  });

  it('uses native links without hydrating a client router tree', () => {
    expect(page).toContain("<a href='/platform-v7/login' className='entry-login'");
    expect(page).toContain("<a href='/platform-v7/register' className='entry-header-register'");
    expect(page).toContain("<a href='/platform-v7/register' className='entry-primary-cta'");
    expect(page).not.toContain("from 'next/link'");
    expect(page).not.toContain('<Link');
  });

  it('keeps exactly two primary hero actions and removes fake-live presentation', () => {
    expect(page).toContain("className='entry-primary-cta'");
    expect(page).toContain("className='entry-secondary-cta'");
    expect(page).not.toContain("className='entry-register-cta'");
    expect(page).not.toContain('MessageCircleQuestion');
    expect(page).not.toContain('DL-9102');
    expect(page).not.toContain("<i />{t('visual.note')}");
    expect(page).toContain("publicLanding('visualBasisText')");
  });

  it('keeps mobile, accessibility and resilient-display gates in static CSS', () => {
    expect(landingCss).toContain('--entry-header-height:64px');
    expect(landingCss).toContain('.entry-process-row{display:flex;gap:10px;overflow-x:auto;padding:0 2px 8px;scroll-snap-type:x proximity}');
    expect(landingCss).toContain('.entry-process-row::-webkit-scrollbar{display:none}');
    expect(landingCss).toContain('flex:0 0 172px');
    expect(worldClassCss).toContain('.pc-site-mobile-menu');
    expect(worldClassCss).toContain('min-height: 44px');
    expect(worldClassCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(worldClassCss).toContain('@media (forced-colors: active)');
    expect(worldClassCss).toContain('.entry-role-access');
    expect(worldClassCss).toContain('.entry-footer');
    expect(mobileShell).toContain('html:has(input:focus, textarea:focus, select:focus)');
    expect(mobileShell).toContain('.pc-v7-role-dock');
    expect(mobileShell).toContain('.p7-support-chat-button');
  });

  it('keeps maturity language truthful', () => {
    const forbidden = ['production' + '-ready', 'fully ' + 'live', 'fully ' + 'integrated', 'bank ' + 'connected', 'FGIS ' + 'connected', 'EDO ' + 'connected'];
    for (const token of forbidden) expect(page.toLowerCase()).not.toContain(token.toLowerCase());
  });
});
