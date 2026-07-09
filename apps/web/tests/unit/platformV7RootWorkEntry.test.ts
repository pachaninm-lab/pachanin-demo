import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('platform-v7 root working entry', () => {
  const page = readFileSync(join(process.cwd(), 'app/platform-v7/page.tsx'), 'utf8');
  const ruMessages = readFileSync(join(process.cwd(), 'messages/ru.json'), 'utf8');
  const mobileShell = readFileSync(join(process.cwd(), 'styles/platform-v7-mobile-shell-p1.css'), 'utf8');

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
    expect(ruMessages).not.toContain('Рабочее место выбирается внутри формы');
    expect(ruMessages).toContain('Сначала выберите роль участника сделки');
    expect(page).not.toContain('key={role.href}');
    expect(page).toContain('key={role.key}');
  });

  it('keeps mobile entry polish guarded', () => {
    expect(page).toContain('--entry-header-height:64px');
    expect(page).toContain('.entry-process-row{display:flex;gap:10px;overflow-x:auto;padding:0 2px 8px;scroll-snap-type:x proximity}');
    expect(page).toContain('.entry-process-row::-webkit-scrollbar{display:none}');
    expect(page).toContain('flex:0 0 172px');
    expect(page).toContain("className='entry-register-cta'");
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
