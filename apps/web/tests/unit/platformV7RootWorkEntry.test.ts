import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('platform-v7 root working entry', () => {
  const page = readFileSync(join(process.cwd(), 'app/platform-v7/page.tsx'), 'utf8');
  const publicMessages = readFileSync(join(process.cwd(), 'i18n/public-entry-messages.ts'), 'utf8');
  const mobileShell = readFileSync(join(process.cwd(), 'styles/platform-v7-mobile-shell-p1.css'), 'utf8');

  it('uses the public execution cockpit as the root entry surface', () => {
    expect(page).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(page).toContain('entry-hero');
    expect(page).toContain('entry-role-grid');
  });

  it('routes all public role cards through the same server-resolved login gate', () => {
    expect(page).toContain("href: '/platform-v7/login'");
    expect(page).not.toContain('/platform-v7/login?role=');
    expect(page).not.toContain("href: '/platform-v7/seller'");
    expect(page).not.toContain("href: '/platform-v7/buyer'");
    expect(page).not.toContain("href: '/platform-v7/bank'");
    expect(publicMessages).toContain('Роль, организация и полномочия определяются сервером');
    expect(page).not.toContain('key={role.href}');
  });

  it('keeps exactly two primary hero actions', () => {
    expect(page).toContain("className='entry-primary-cta'");
    expect(page).toContain("className='entry-secondary-cta'");
    expect(page).not.toContain("className='entry-register-cta'");
    expect(page).not.toContain('MessageCircleQuestion');
  });

  it('keeps mobile entry polish guarded', () => {
    expect(page).toContain('--entry-header-height:64px');
    expect(page).toContain('.entry-process-row{display:flex;gap:10px;overflow-x:auto;padding:0 2px 8px;scroll-snap-type:x proximity}');
    expect(page).toContain('.entry-process-row::-webkit-scrollbar{display:none}');
    expect(page).toContain('flex:0 0 172px');
    expect(page).toContain("href='/platform-v7/register'");
    expect(page).toContain('.entry-primary-cta{color:#fff;background:linear-gradient(135deg,#087a3b,#0b6a37)');
    expect(mobileShell).toContain('html:has(input:focus, textarea:focus, select:focus)');
    expect(mobileShell).toContain('.pc-v7-role-dock');
    expect(mobileShell).toContain('.p7-support-chat-button');
    expect(mobileShell).toContain('.p7-register-page:has(input:focus, textarea:focus, select:focus) .p7-register-hero');
  });

  it('keeps maturity language guarded', () => {
    const forbidden = ['production' + '-ready', 'fully ' + 'live', 'fully ' + 'integrated', 'bank ' + 'connected', 'FGIS ' + 'connected', 'EDO ' + 'connected'];
    for (const token of forbidden) expect(page.toLowerCase()).not.toContain(token.toLowerCase());
  });
});
