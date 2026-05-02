import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ROLE_EXECUTION_SUMMARIES, type PlatformV7ExecutionRole } from '@/components/platform-v7/RoleExecutionSummary';

const coveredRoles: PlatformV7ExecutionRole[] = [
  'seller',
  'buyer',
  'logistics',
  'driver',
  'elevator',
  'lab',
  'surveyor',
  'bank',
  'arbitrator',
  'compliance',
  'operator',
  'executive',
  'investor',
];

describe('platform-v7 role execution summary', () => {
  it('defines a summary for every fast-pass role', () => {
    expect(Object.keys(PLATFORM_V7_ROLE_EXECUTION_SUMMARIES).sort()).toEqual([...coveredRoles].sort());
  });

  it('keeps each summary short, concrete and action-oriented', () => {
    for (const role of coveredRoles) {
      const summary = PLATFORM_V7_ROLE_EXECUTION_SUMMARIES[role];

      expect(summary.title.length).toBeGreaterThan(2);
      expect(summary.now.length).toBeGreaterThan(8);
      expect(summary.blocked.length).toBeGreaterThan(8);
      expect(summary.money.length).toBeGreaterThan(8);
      expect(summary.documents.length).toBeGreaterThan(8);
      expect(summary.execution.length).toBeGreaterThan(8);
      expect(summary.next.length).toBeGreaterThan(3);
      expect(summary.cta).toMatch(/^(Открыть|Сделать|Зафиксировать|Загрузить|Запросить)/);
      expect(summary.href).toMatch(/^\/platform-v7/);
    }
  });

  it('keeps driver and logistics away from money visibility claims', () => {
    expect(PLATFORM_V7_ROLE_EXECUTION_SUMMARIES.driver.money).toContain('скрыты');
    expect(PLATFORM_V7_ROLE_EXECUTION_SUMMARIES.logistics.money).toContain('не раскрываются');
  });

  it('keeps bank wording tied to confirmation and checks, not platform guarantees', () => {
    const bankText = Object.values(PLATFORM_V7_ROLE_EXECUTION_SUMMARIES.bank).join(' ');

    expect(bankText).toContain('подтверждение выпуска');
    expect(bankText).not.toContain('платформа выпускает');
    expect(bankText).not.toContain('гарантирует оплату');
  });
});
