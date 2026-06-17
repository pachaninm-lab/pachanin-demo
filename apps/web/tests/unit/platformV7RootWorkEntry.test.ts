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

  it('shows stable public entry routes', () => {
    expect(page).toContain('/platform-v7/seller');
    expect(page).toContain('/platform-v7/buyer');
    expect(page).toContain('/platform-v7/open');
  });

  it('keeps maturity language guarded', () => {
    const forbidden = ['production' + '-ready', 'fully ' + 'live', 'fully ' + 'integrated', 'bank ' + 'connected', 'FGIS ' + 'connected', 'EDO ' + 'connected'];
    for (const token of forbidden) {
      expect(page.toLowerCase()).not.toContain(token.toLowerCase());
    }
  });
});
