import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Phase 2 / PR-6 — empty-state path for the Surveyor cabinet's static assignment
// list. Narrow + content-local: the assignment list now renders the canonical
// EmptyState when there are no assignments, instead of an empty section. No
// redesign, no business-logic change. (Compliance has no page-local list — its
// content is rendered by shared, always-populated cockpit components — so it is
// intentionally out of scope; see ROLE_COCKPIT_AUDIT.md §5 #7.)

const surveyor = readFileSync(
  resolve(__dirname, '../../app/platform-v7/surveyor/page.tsx'),
  'utf8',
);

describe('surveyor cabinet assignment list has an empty-state path', () => {
  it('uses the canonical EmptyState component', () => {
    expect(surveyor).toContain("import { EmptyState } from '@/components/platform-v7/EmptyState'");
  });

  it('guards the static assignment list with an empty branch before mapping', () => {
    expect(surveyor).toMatch(/ASSIGNMENTS\.length === 0 \?/);
    expect(surveyor).toContain('<EmptyState');
    expect(surveyor).toContain('Назначений на осмотр нет');
  });

  it('still renders the assignment list when assignments exist (non-empty branch preserved)', () => {
    expect(surveyor).toContain('ASSIGNMENTS.map((a) => (');
    expect(surveyor).toContain('/platform-v7/surveyor/acts/');
  });

  it('keeps the empty-state copy free of fake-live / overclaim wording', () => {
    const lower = surveyor.toLowerCase();
    for (const phrase of ['production-ready', 'fully live', 'bank connected', 'гарантирует оплату']) {
      expect(lower).not.toContain(phrase.toLowerCase());
    }
  });
});
