import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const aliases = [
  ['driver', '/platform-v7/driver'],
  ['elevator', '/platform-v7/elevator'],
  ['lab', '/platform-v7/lab'],
  ['surveyor', '/platform-v7/surveyor'],
  ['bank', '/platform-v7/bank'],
  ['compliance', '/platform-v7/compliance'],
  ['arbitrator', '/platform-v7/arbitrator'],
  ['executive', '/platform-v7/executive'],
  ['operator', '/platform-v7/operator'],
] as const;

const forbiddenFixtureMarkers = [
  'DL-9106',
  'TRIP-SIM-001',
  'ACT-SIM-001',
  'SC-9106-01',
  'PL-4491',
  'ESC-',
  '9,65 млн',
  '624 тыс.',
  '62% пути',
  '14:28',
  'useState',
  'style={{',
] as const;

describe('Platform V7 role grain compatibility aliases', () => {
  for (const [role, canonicalRoute] of aliases) {
    const file = `apps/web/app/platform-v7/${role}/grain/page.tsx`;
    const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');

    it(`${role}/grain redirects to the canonical role workspace`, () => {
      expect(source).toContain("import { redirect } from 'next/navigation'");
      expect(source).toContain(`redirect('${canonicalRoute}')`);
      expect(source).not.toContain("'use client'");
      expect(source).not.toContain('Link');
      for (const marker of forbiddenFixtureMarkers) expect(source).not.toContain(marker);
    });
  }
});
