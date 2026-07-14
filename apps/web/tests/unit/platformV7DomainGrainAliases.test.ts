import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const aliases = [
  ['documents', '/platform-v7/documents'],
  ['reports', '/platform-v7/reports'],
  ['logistics', '/platform-v7/logistics'],
  ['integrations', '/platform-v7/connectors'],
  ['readiness', '/platform-v7/status'],
  ['settlement', '/platform-v7/money'],
  ['control-tower', '/platform-v7/control-tower'],
] as const;

const forbiddenFixtureMarkers = [
  'DL-9106',
  '9,65 млн',
  '8,86 млн',
  '0,62 млн',
  'TRIP-SIM-001',
  'ЭДО — работает',
  'Банк — готов к API',
  'GitHub Actions — пройдены',
  'опасная фраза',
  'style={{',
  'dangerouslySetInnerHTML',
] as const;

describe('Platform V7 domain grain compatibility aliases', () => {
  for (const [domain, canonicalRoute] of aliases) {
    const file = `apps/web/app/platform-v7/${domain}/grain/page.tsx`;
    const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');

    it(`${domain}/grain redirects to the canonical governed workspace`, () => {
      expect(source).toContain("import { redirect } from 'next/navigation'");
      expect(source).toContain(`redirect('${canonicalRoute}')`);
      expect(source).not.toContain("'use client'");
      expect(source).not.toContain('Link');
      for (const marker of forbiddenFixtureMarkers) expect(source).not.toContain(marker);
    });
  }
});
