import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const aliases = [
  ['auth', '/platform-v7/login'],
  ['market-rfq', '/platform-v7/buyer/rfq'],
  ['trading', '/platform-v7/auction'],
  ['fgis-to-lot', '/platform-v7/auction/import'],
  ['runtime-status', '/platform-v7/status'],
  ['deploy-check', '/platform-v7/status'],
] as const;

const forbiddenMarkers = [
  "'use client'",
  'localStorage',
  'sessionStorage',
  'Покупатель №1',
  'Поставщик №1',
  'Песочница',
  'main-refresh-3',
  'Условно зелёный',
  'Ручная проверка',
  'DL-9106',
  'style={{',
] as const;

describe('Platform V7 compatibility aliases', () => {
  for (const [route, canonicalRoute] of aliases) {
    const file = `apps/web/app/platform-v7/${route}/page.tsx`;
    const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');

    it(`${route} redirects to ${canonicalRoute}`, () => {
      expect(source).toContain("import { redirect } from 'next/navigation'");
      expect(source).toContain(`redirect('${canonicalRoute}')`);
      expect(source).not.toContain('Link');
      for (const marker of forbiddenMarkers) expect(source).not.toContain(marker);
    });
  }
});
