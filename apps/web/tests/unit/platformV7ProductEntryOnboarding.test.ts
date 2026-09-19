import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getPlatformV7OpenWalkthroughState } from '../../lib/platform-v7/runtime/open-walkthrough';

const readRoute = (route: string) => readFileSync(resolve(process.cwd(), `app/platform-v7/${route}/page.tsx`), 'utf8');

describe('platform-v7 product entry onboarding', () => {
  it('exposes open walkthrough state without live claims', () => {
    const state = getPlatformV7OpenWalkthroughState();

    expect(state.maturity).toBe('controlled-pilot');
    expect(state.externalMode).toBe('pre-integration');
    expect(state.steps.map((step) => step.id)).toEqual(['price', 'execution', 'access']);
    expect(state.roles.length).toBeGreaterThan(2);
    expect(state.gates.some((gate) => gate.state === 'requires-agreement')).toBe(true);
  });

  it('keeps product entry routes inside controlled-pilot wording', () => {
    const joined = ['open', 'role-preview', 'onboarding'].map(readRoute).join('\n');

    expect(joined).toContain('controlled');
    expect(joined).toContain('pre-integration');
    expect(joined).not.toMatch(/production-ready|fully live|fully integrated|bank connected|FGIS connected|EDO connected/i);
  });
});
