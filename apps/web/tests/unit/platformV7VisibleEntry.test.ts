import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = () => readFileSync('app/platform-v7/page.tsx', 'utf8');

describe('platform-v7 visible entry cockpit', () => {
  it('shows the execution path from blocker to money', () => {
    const src = source();

    expect(src).toContain('От причины к деньгам за один экран');
    expect(src).toContain('документ, рейс, качество или спор → блокер → деньги → ответственный → действие');
    expect(src).toContain('цена и допуск');
    expect(src).toContain('доказательства');
  });

  it('shows role entry points instead of a test-only completion screen', () => {
    const src = source();

    expect(src).toContain('Ролевой вход');
    expect(src).toContain('/platform-v7/control-tower');
    expect(src).toContain('/platform-v7/buyer');
    expect(src).toContain('/platform-v7/driver/field');
    expect(src).toContain('/platform-v7/bank/release-safety');
  });

  it('keeps maturity honest and avoids fake-live claims', () => {
    const src = source();

    expect(src).toContain('Controlled-pilot / pre-integration');
    expect(src).toContain('Боевые подключения требуют доступов и договоров');
    expect(src).not.toMatch(/production-ready|fully live|fully integrated|bank connected|FGIS connected|EDO connected/i);
  });
});
