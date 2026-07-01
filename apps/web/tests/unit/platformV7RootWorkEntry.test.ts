import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('platform-v7 root working entry', () => {
  const page = readFileSync(join(process.cwd(), 'app/platform-v7/page.tsx'), 'utf8');

  it('uses the public execution cockpit as the root entry surface', () => {
    expect(page).toContain("data-testid='platform-v7-root-execution-cockpit'");
    expect(page).toContain('entry-hero');
    expect(page).toContain('entry-role-grid');
  });

  it('routes public role cards through role-selected login instead of direct cabinets', () => {
    expect(page).toContain('/platform-v7/login?role=seller');
    expect(page).toContain('/platform-v7/login?role=buyer');
    expect(page).toContain('/platform-v7/login?role=operator');
    expect(page).toContain('/platform-v7/login?role=executive');
    expect(page).not.toContain("href: '/platform-v7/seller'");
    expect(page).not.toContain("href: '/platform-v7/buyer'");
    expect(page).not.toContain("href: '/platform-v7/bank'");
    expect(page).not.toContain('Рабочее место выбирается внутри формы');
    expect(page).toContain('Сначала выберите роль участника сделки');
    expect(page).not.toContain('key={role.href}');
    expect(page).toContain('key={role.title}');
  });

  it('keeps mobile entry polish guarded', () => {
    expect(page).toContain('--entry-header-height:70px');
    expect(page).toContain('--entry-header-height:64px');
    expect(page).toContain('.entry-header{grid-template-columns:1fr auto;padding:9px 16px;gap:10px}');
    expect(page).toContain('scroll-snap-type: x mandatory');
    expect(page).toContain("className='entry-register-cta'");
    expect(page).toContain("href='/platform-v7/register'");
    expect(page).toContain('color:#fff!important;background:#087a3b');
  });

  it('keeps maturity language guarded', () => {
    const forbidden = ['production' + '-ready', 'fully ' + 'live', 'fully ' + 'integrated', 'bank ' + 'connected', 'FGIS ' + 'connected', 'EDO ' + 'connected'];
    for (const token of forbidden) {
      expect(page.toLowerCase()).not.toContain(token.toLowerCase());
    }
  });
});
