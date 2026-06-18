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

  it('routes public role cards through login instead of direct cabinets', () => {
    expect(page).toContain('/platform-v7/login');
    expect(page).not.toContain("href: '/platform-v7/seller'");
    expect(page).not.toContain("href: '/platform-v7/buyer'");
    expect(page).not.toContain("href: '/platform-v7/bank'");
    expect(page).not.toContain("key={role.href}");
    expect(page).toContain("key={role.title}");
  });

  it('keeps maturity language guarded', () => {
    const forbidden = ['production' + '-ready', 'fully ' + 'live', 'fully ' + 'integrated', 'bank ' + 'connected', 'FGIS ' + 'connected', 'EDO ' + 'connected'];
    for (const token of forbidden) {
      expect(page.toLowerCase()).not.toContain(token.toLowerCase());
    }
  });
});
