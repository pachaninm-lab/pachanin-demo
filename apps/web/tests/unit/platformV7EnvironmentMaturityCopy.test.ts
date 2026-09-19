import { describe, expect, it } from 'vitest';
import {
  platformV7EnvironmentInfo,
  type PlatformEnvironment,
} from '@/lib/platform-v7/environment';

const environments: PlatformEnvironment[] = ['pilot', 'sandbox', 'demo', 'production'];

describe('platform-v7 environment maturity copy', () => {
  it('keeps every environment description explicit and non-empty', () => {
    for (const environment of environments) {
      const info = platformV7EnvironmentInfo(environment);

      expect(info.label.trim()).not.toBe('');
      expect(info.description.trim()).not.toBe('');
      expect(info.description.length).toBeGreaterThan(20);
    }
  });

  it('keeps pilot and demo language away from industrial-use promises', () => {
    const pilot = platformV7EnvironmentInfo('pilot').description;
    const demo = platformV7EnvironmentInfo('demo').description;

    expect(pilot).toContain('требуют отдельного подтверждения');
    expect(demo).toContain('без обещания промышленной эксплуатации');
  });

  it('keeps production language conditional on confirmed readiness', () => {
    const production = platformV7EnvironmentInfo('production').description;

    expect(production).toContain('после подтверждённых подключений');
    expect(production).toContain('договоров');
    expect(production).toContain('реальных сделок');
  });
});
