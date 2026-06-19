import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const roots = [
  'app/platform-v7',
  'components/platform-v7',
  'components/v7r',
  'lib/platform-v7',
] as const;

// Surfaces that intentionally carry demo placeholder contacts, the platform's
// own contact, a demo company directory, or operationally-required vehicle
// plates (logistics/dispatch). These are reviewed as non-bypass demo data, not
// real counterparty PII. The guard still protects every other runtime source.
const allowedFiles = new Set([
  'tests/unit/platformV7DataExposureGuard.test.ts',
  'app/platform-v7/about/page.tsx',
  'app/platform-v7/investor/page.tsx',
  'app/platform-v7/register/page.tsx',
  'app/platform-v7/profile/team/page.tsx',
  'app/platform-v7/companies/[inn]/page.tsx',
  'app/platform-v7/logistics/[routeId]/page.tsx',
  'components/v7r/RoleActionDispatchBridge.tsx',
  'lib/platform-v7/bank-compliance-pilot.ts',
  'lib/platform-v7/grain-execution/mock-data.ts',
]);

// Test fixtures and mock/demo data files are not user-facing runtime surfaces.
const isNonRuntimeFile = (file: string) => /\.(test|spec)\.tsx?$/.test(file) || /(?:^|\/)(?:mock|fixtures?)[^/]*$/i.test(file);

const directPhonePattern = /(?:\+7|8)[\s\-()]?\d{3}[\s\-()]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const unmaskedPlatePattern = /[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}/u;

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    return [full.replaceAll('\\', '/')];
  });
}

describe('platform-v7 data exposure guard', () => {
  it('does not hardcode raw phone numbers, emails or unmasked vehicle plates in platform runtime sources', () => {
    const files = roots.flatMap(listFiles).filter((file) => !allowedFiles.has(file) && !isNonRuntimeFile(file));
    const leaks = files.flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      const findings: string[] = [];
      if (directPhonePattern.test(source)) findings.push('raw phone');
      if (emailPattern.test(source) && !source.includes('@testing-library')) findings.push('raw email');
      if (unmaskedPlatePattern.test(source)) findings.push('unmasked vehicle plate');
      return findings.map((finding) => `${file}: ${finding}`);
    });

    expect(leaks).toEqual([]);
  });

  it('keeps platform language around masked contacts and controlled disclosure', () => {
    const antiBypass = fs.existsSync('app/platform-v7/anti-bypass/page.tsx')
      ? fs.readFileSync('app/platform-v7/anti-bypass/page.tsx', 'utf8')
      : '';
    const sourceOfTruth = fs.readFileSync('lib/platform-v7/workflow-source-of-truth.ts', 'utf8');

    expect(`${antiBypass}\n${sourceOfTruth}`).toMatch(/контакт|Контакт|контакты|Контакты/);
    expect(sourceOfTruth).toContain('Контактные данные замаскированы');
  });
});
