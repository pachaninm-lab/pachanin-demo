import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = existsSync(path.join(process.cwd(), 'app/platform-v7')) ? process.cwd() : path.join(process.cwd(), 'apps/web');

function read(rel: string): string {
  const fullPath = path.join(root, rel);
  expect(existsSync(fullPath), `file missing: ${rel}`).toBe(true);
  return readFileSync(fullPath, 'utf8');
}

// ────────────────────────────────────────────────────────────
// Guard 1 — support routes exist (all 4 required)
// ────────────────────────────────────────────────────────────
describe('Guard 1 — support routes exist', () => {
  const routes = [
    'app/platform-v7/support/page.tsx',
    'app/platform-v7/support/new/page.tsx',
    'app/platform-v7/support/[caseId]/page.tsx',
    'app/platform-v7/support/operator/page.tsx',
  ];

  it('all four support route files exist', () => {
    for (const route of routes) {
      expect(existsSync(path.join(root, route)), `missing: ${route}`).toBe(true);
    }
  });

  it('support list page uses execution-center heading', () => {
    const content = read('app/platform-v7/support/page.tsx');
    expect(content).toContain('исполнения сделки');
  });

  it('support operator route uses SupportOperatorQueueClient', () => {
    const content = read('app/platform-v7/support/operator/page.tsx');
    expect(content).toContain('SupportOperatorQueueClient');
  });
});

// ────────────────────────────────────────────────────────────
// Guard 2 — support data includes deal/trip/document/dispute context
// ────────────────────────────────────────────────────────────
describe('Guard 2 — support data has execution context', () => {
  it('support-data.ts exports SUPPORT_CASES with dealId and tripId entries', () => {
    const content = read('lib/platform-v7/support-data.ts');
    expect(content).toContain('dealId');
    expect(content).toContain('tripId');
    expect(content).toContain('moneyAtRiskRub');
  });

  it('support-types.ts SupportCase includes all required execution fields', () => {
    const content = read('lib/platform-v7/support-types.ts');
    expect(content).toContain('dealId');
    expect(content).toContain('tripId');
    expect(content).toContain('moneyAtRiskRub');
    expect(content).toContain('blocker');
    expect(content).toContain('nextAction');
    expect(content).toContain('evidenceNeeded');
    expect(content).toContain('owner');
    expect(content).toContain('slaDueAt');
  });

  it('support-data.ts has evidenceNeeded arrays in sample cases', () => {
    const content = read('lib/platform-v7/support-data.ts');
    expect(content).toContain('evidenceNeeded');
    // must have at least one non-empty evidenceNeeded array
    expect(content).toMatch(/evidenceNeeded:\s*\[['"][^'"]/);
  });

  it('SupportCategory covers all required domains', () => {
    const content = read('lib/platform-v7/support-types.ts');
    for (const domain of ['money', 'documents', 'logistics', 'acceptance', 'quality', 'dispute']) {
      expect(content).toContain(`'${domain}'`);
    }
  });
});

// ────────────────────────────────────────────────────────────
// Guard 3 — operator page has money at risk, priority, owner, blocker, next action
// ────────────────────────────────────────────────────────────
describe('Guard 3 — operator queue exposes triage fields', () => {
  it('SupportOperatorQueueClient shows money at risk', () => {
    const content = read('components/platform-v7/SupportOperatorQueueClient.tsx');
    expect(content).toContain('moneyAtRiskRub');
    expect(content).toContain('supportFormatRub');
  });

  it('SupportOperatorQueueClient shows priority filter', () => {
    const content = read('components/platform-v7/SupportOperatorQueueClient.tsx');
    expect(content).toContain('P0');
    expect(content).toContain('P1');
  });

  it('SupportOperatorQueueClient shows blocker and next action', () => {
    const content = read('components/platform-v7/SupportOperatorQueueClient.tsx');
    expect(content).toContain('blocker');
    expect(content).toContain('nextAction');
  });

  it('SupportOperatorQueueClient shows owner', () => {
    const content = read('components/platform-v7/SupportOperatorQueueClient.tsx');
    expect(content).toContain('owner');
  });

  it('SupportOperatorQueueClient shows evidenceNeeded', () => {
    const content = read('components/platform-v7/SupportOperatorQueueClient.tsx');
    expect(content).toContain('evidenceNeeded');
  });

  it('operator page has pilot-safe actions only (no fake bank release)', () => {
    const content = read('components/platform-v7/SupportOperatorQueueClient.tsx');
    // must not claim support can release money or confirm bank
    expect(content).not.toMatch(/выпустить деньги/i);
    expect(content).not.toMatch(/банк подтвердил/i);
    expect(content).not.toMatch(/деньги переведены/i);
    expect(content).not.toMatch(/выплата выполнена/i);
  });
});

// ────────────────────────────────────────────────────────────
// Guard 4 — internal notes do not leak to normal user case page
// ────────────────────────────────────────────────────────────
describe('Guard 4 — internal notes isolation', () => {
  it('SupportCaseRouteClient passes empty notes array to SupportCaseView', () => {
    const content = read('components/platform-v7/SupportCaseRouteClient.tsx');
    // notes prop must be empty array, not filtered internalNotes
    expect(content).toContain('notes={[]}');
    // must NOT pass operator internal notes to user-facing view
    expect(content).not.toMatch(/notes=\{internalNotes/);
  });

  it('SupportCaseView only renders internal notes section when notes array is non-empty', () => {
    const content = read('components/platform-v7/SupportCaseView.tsx');
    // the internal notes section must be gated on sortedNotes.length > 0
    expect(content).toContain('sortedNotes.length > 0');
  });
});

// ────────────────────────────────────────────────────────────
// Guard 5 — no support copy claims money can be released by support
// ────────────────────────────────────────────────────────────
describe('Guard 5 — copy does not overclaim support capabilities', () => {
  const supportFiles = [
    'components/platform-v7/SupportIndexPage.tsx',
    'components/platform-v7/SupportCaseView.tsx',
    'components/platform-v7/SupportNewCaseClient.tsx',
    'components/platform-v7/SupportOperatorQueueClient.tsx',
    'app/platform-v7/support/page.tsx',
    'app/platform-v7/support/new/page.tsx',
    'app/platform-v7/support/operator/page.tsx',
  ];

  const forbiddenPhrases = [
    'поддержка выпустит деньги',
    'выплата будет выполнена',
    'деньги переведены',
    'банк подтвердил',
    'деньги отправлены',
    'поддержка подтверждает',
    'немедленно решим',
    'гарантируем решение',
  ];

  it('support pages have no overclaiming copy', () => {
    for (const file of supportFiles) {
      const content = read(file).toLowerCase();
      for (const phrase of forbiddenPhrases) {
        expect(content, `"${phrase}" found in ${file}`).not.toContain(phrase);
      }
    }
  });

  it('support case view shows blocker and evidence needed, not resolution promise', () => {
    const content = read('components/platform-v7/SupportCaseView.tsx');
    expect(content).toContain('blocker');
    expect(content).toContain('evidenceNeeded');
    expect(content).toContain('nextAction');
  });

  it('new case form shows what support can and cannot do', () => {
    const content = read('components/platform-v7/SupportNewCaseClient.tsx');
    // must have at least one disclaimer about what support cannot do
    expect(content).toMatch(/не (меняет|выпускает|закрывает|обещает|выпуск)/i);
  });
});

// ────────────────────────────────────────────────────────────
// Guard 6 — no apps/landing changes
// ────────────────────────────────────────────────────────────
describe('Guard 6 — no apps/landing contamination', () => {
  const supportLibFiles = [
    'lib/platform-v7/support-types.ts',
    'lib/platform-v7/support-data.ts',
    'lib/platform-v7/support-helpers.ts',
    'lib/platform-v7/support-client-store.ts',
  ];

  it('support lib files do not import from apps/landing', () => {
    for (const file of supportLibFiles) {
      const content = read(file);
      expect(content, `apps/landing import found in ${file}`).not.toContain('apps/landing');
    }
  });

  it('support component files do not import from apps/landing', () => {
    const componentFiles = [
      'components/platform-v7/SupportIndexPage.tsx',
      'components/platform-v7/SupportCaseView.tsx',
      'components/platform-v7/SupportOperatorQueueClient.tsx',
    ];
    for (const file of componentFiles) {
      const content = read(file);
      expect(content, `apps/landing import found in ${file}`).not.toContain('apps/landing');
    }
  });
});
