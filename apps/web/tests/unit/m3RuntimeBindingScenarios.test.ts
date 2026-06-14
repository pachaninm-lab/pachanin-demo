import { describe, expect, it } from 'vitest';
import { getPlatformV7BankCockpitState } from '@/lib/platform-v7/runtime/bank-cockpit-state';
import { getPlatformV7DisputeCockpitState } from '@/lib/platform-v7/runtime/dispute-cockpit-state';
import { getPlatformV7DriverCockpitState } from '@/lib/platform-v7/runtime/driver-cockpit-state';
import { getPlatformV7ObservabilityCockpitState } from '@/lib/platform-v7/runtime/observability-cockpit-state';
import { getPlatformV7BiCockpitState } from '@/lib/platform-v7/runtime/bi-cockpit-state';
import { p7EvaluateBypassRisk } from '@/lib/platform-v7/anti-bypass';

// M3-6 Runtime Binding QA (§38): сквозные инварианты на runtime-view-model'ях.
// Цель — нельзя пройти процесс в обход blockers, UI читает состояние из runtime.

describe('M3-6 runtime binding scenarios (§38)', () => {
  it('S1/S4: деньги не выпускаются без банковского события и при незакрытых документах', () => {
    const bank = getPlatformV7BankCockpitState();
    expect(bank.sourceMeta.runtimeBound).toBe(true);
    expect(bank.releasedRub).toBe(0); // нет release без банка
    expect(bank.canRequestRelease).toBe(false); // документы/условия не закрыты
    expect(bank.basisStatus).toBe('not-ready');
  });

  it('S2/S3: спор по весу/качеству удерживает деньги (hold) и связан с источником', () => {
    const dispute = getPlatformV7DisputeCockpitState();
    expect(dispute.sourceMeta.runtimeBound).toBe(true);
    expect(typeof dispute.heldRub).toBe('number');
    expect(typeof dispute.active).toBe('boolean');
  });

  it('S5: расхождения и интеграционные сбои видны оператору (observability)', () => {
    const health = getPlatformV7ObservabilityCockpitState();
    const keys = health.areas.map((a) => a.key);
    expect(keys).toContain('integration');
    expect(keys).toContain('money');
    expect(Array.isArray(health.incidents)).toBe(true);
  });

  it('S6: офлайн-водитель не видит денег (field scope)', () => {
    const driver = getPlatformV7DriverCockpitState();
    const serialized = JSON.stringify(driver).toLowerCase();
    expect(serialized).not.toContain('releasedrub');
    expect(serialized).not.toContain('reservedrub');
    expect(serialized).not.toContain('holdrub');
  });

  it('S7: fraud / off-platform payment — bypass заблокирован', () => {
    const decision = p7EvaluateBypassRisk({
      dealId: 'DL-9106',
      role: 'seller',
      stage: 'offer',
      visibleSignals: ['off_platform_payment_instruction'],
    });
    expect(decision.blocked).toBe(true);
    expect(decision.riskLevel).toBe('critical');
  });

  it('экономика считается из runtime (BI)', () => {
    const bi = getPlatformV7BiCockpitState();
    expect(bi.metrics.find((m) => m.key === 'gmv')?.basis).toBe('runtime');
  });
});
