import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getPlatformV7EntryCockpitState } from '../../lib/platform-v7/runtime/entry-cockpit-state';

const pageSource = () => readFileSync(resolve(__dirname, '../../app/platform-v7/page.tsx'), 'utf8');

describe('platform-v7 runtime entry cockpit', () => {
  it('returns runtime-facing cockpit state', () => {
    const state = getPlatformV7EntryCockpitState();

    expect(state.sourceMeta.runtimeBound).toBe(true);
    expect(state.sourceMeta.liveExternalIntegrations).toBe(false);
    expect(state.executionPath).toContain('цена и допуск');
    expect(state.executionPath).toContain('доказательства');
    expect(state.blockers.length).toBeGreaterThan(0);
    expect(state.lanes.length).toBeGreaterThan(0);
    expect(state.primaryBlocker?.href).toContain('/platform-v7/');
    expect(state.maturityNotice).toContain('live-интеграциях');
  });

  it('keeps operational runtime arrays out of the page component', () => {
    const src = pageSource();

    // Публичная главная может хранить карточки ролей, но не должна тащить runtime-массивы cockpit state.
    expect(src).toContain('/platform-v7/login?role=operator');
    expect(src).not.toMatch(/const\s+blockers\s*=/);
    expect(src).not.toMatch(/const\s+lanes\s*=/);
    expect(src).not.toMatch(/const\s+executionPath\s*=/);
    expect(src).not.toMatch(/const\s+proofItems\s*=/);
  });

  it('keeps maturity honest', () => {
    const src = pageSource();
    const state = getPlatformV7EntryCockpitState();
    const joined = `${src}\n${state.maturityNotice}`;

    expect(joined).not.toMatch(/production-ready|fully live|fully integrated|bank connected|FGIS connected|EDO connected/i);
  });
});
