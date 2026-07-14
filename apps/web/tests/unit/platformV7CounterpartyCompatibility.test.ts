import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const companies = read('apps/web/app/platform-v7/companies/page.tsx');
const company = read('apps/web/app/platform-v7/companies/[inn]/page.tsx');
const counterpartyByInn = read('apps/web/app/platform-v7/counterparty/[inn]/page.tsx');
const counterpartyById = read('apps/web/app/platform-v7/counterparties/[counterpartyId]/page.tsx');
const compliance = read('apps/web/app/platform-v7/compliance/page.tsx');
const scope = read('scripts/check-design-system-v8-pr-scope.mjs');

const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 counterparty compatibility authority', () => {
  it('routes the fixture company registry to the compliance authority', () => {
    expect(companies).toContain("import { redirect } from 'next/navigation'");
    expect(companies).toContain("redirect('/platform-v7/compliance')");
    for (const fixture of ['COMPANIES', 'Агрохолдинг СК', 'МаслоПресс ООО', 'ПромАгро АО', '4.8 / 5', '12']) {
      expect(companies).not.toContain(fixture);
    }
    expect(companies).not.toMatch(forbiddenPresentation);
  });

  it('preserves the requested INN without claiming a verified company profile', () => {
    for (const legacyPage of [company, counterpartyByInn]) {
      expect(legacyPage).toContain("import { redirect } from 'next/navigation'");
      expect(legacyPage).toContain('encodeURIComponent(params.inn)');
      expect(legacyPage).toContain('/platform-v7/compliance?inn=');
      expect(legacyPage).not.toMatch(forbiddenPresentation);
    }
    for (const fixture of ['6829123456', '4.8 / 5', '74%', 'Проверено ФГИС', 'Пройдена', 'READINESS']) {
      expect(company).not.toContain(fixture);
      expect(counterpartyByInn).not.toContain(fixture);
    }
  });

  it('preserves an opaque counterparty ID and removes the generic workflow fixture', () => {
    expect(counterpartyById).toContain('encodeURIComponent(params.counterpartyId)');
    expect(counterpartyById).toContain('/platform-v7/compliance?counterpartyId=');
    expect(counterpartyById).not.toContain('GrainWorkflowPage');
    expect(counterpartyById).not.toContain('рейтинг, риск, историю исполнения');
    expect(counterpartyById).not.toMatch(forbiddenPresentation);
  });

  it('lands in the governed compliance workspace without creating browser authority', () => {
    expect(compliance).toContain('OperationalDecisionCockpit');
    expect(compliance).toContain('human-in-the-loop');
    expect(compliance).toContain('не меняет роли через клиент');
    expect(compliance).not.toContain('searchParams?.inn');
    expect(compliance).not.toContain('searchParams?.counterpartyId');
  });

  it('keeps all compatibility routes inside the exact migration scope', () => {
    for (const file of [
      'apps/web/app/platform-v7/companies/page.tsx',
      'apps/web/app/platform-v7/companies/[inn]/page.tsx',
      'apps/web/app/platform-v7/counterparty/[inn]/page.tsx',
      'apps/web/app/platform-v7/counterparties/[counterpartyId]/page.tsx',
      'apps/web/tests/unit/platformV7CounterpartyCompatibility.test.ts',
    ]) {
      expect(scope).toContain(`'${file}'`);
    }
  });
});
