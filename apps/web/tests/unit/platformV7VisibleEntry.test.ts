import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// VP-3 moved the cockpit content into the runtime state module; the page
// renders that state. The visible-entry contract spans both sources.
const pageSource = () => readFileSync(resolve(__dirname, '../../app/platform-v7/page.tsx'), 'utf8');
const stateSource = () => readFileSync(resolve(__dirname, '../../lib/platform-v7/runtime/entry-cockpit-state.ts'), 'utf8');

describe('platform-v7 visible entry cockpit', () => {
  it('shows the execution path from blocker to money', () => {
    const page = pageSource();
    const state = stateSource();

    expect(page).toContain('От причины к деньгам за один экран');
    expect(page).toContain('executionPath');
    expect(state).toContain('цена и допуск');
    expect(state).toContain('доказательства');
  });

  it('shows role entry points instead of a test-only completion screen', () => {
    const page = pageSource();
    const state = stateSource();

    expect(page).toContain('Ролевой вход');
    expect(page).toContain('/platform-v7/control-tower');
    expect(state).toContain('/platform-v7/buyer');
    expect(state).toContain('/platform-v7/driver/field');
    expect(state).toContain('/platform-v7/bank/release-safety');
  });

  it('keeps maturity honest and avoids fake-live claims', () => {
    const page = pageSource();
    const state = stateSource();

    expect(state).toContain('Controlled-pilot / pre-integration');
    expect(state).toContain('Боевые подключения требуют доступов и договоров');
    for (const src of [page, state]) {
      expect(src).not.toMatch(/production-ready|fully live|fully integrated|bank connected|FGIS connected|EDO connected/i);
    }
  });
});
