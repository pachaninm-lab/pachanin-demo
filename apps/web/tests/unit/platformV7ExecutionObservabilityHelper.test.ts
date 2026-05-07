import { describe, expect, it } from 'vitest';
import { checkPlatformV7ExecutionGate } from '@/lib/platform-v7/execution-gate-helper';
import { buildPlatformV7ExecutionResult } from '@/lib/platform-v7/execution-result-helper';
import {
  buildPlatformV7ExecutionObservabilitySignals,
  getPlatformV7ExecutionObservabilitySummary,
  hasPlatformV7CriticalExecutionSignal,
} from '@/lib/platform-v7/execution-observability-helper';

describe('platform-v7 execution observability helper', () => {
  it('creates info signal for contract-only valid boundary', () => {
    const gate = checkPlatformV7ExecutionGate({
      boundaryId: 'request_money_reserve',
      actorId: 'buyer-1',
      actorRole: 'buyer',
      entityId: 'money-1',
      entityType: 'money_record',
      payload: {
        dealId: 'deal-1',
        amountMinor: 100,
        currency: 'RUB',
        reason: 'Reserve request.',
      },
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Reserve boundary recorded.',
    });

    const result = buildPlatformV7ExecutionResult(gate);
    const signals = buildPlatformV7ExecutionObservabilitySignals(result);

    expect(signals.map((signal) => signal.kind)).toEqual(['execution_contract_only', 'execution_boundary_issue']);
    expect(hasPlatformV7CriticalExecutionSignal(signals)).toBe(false);
    expect(getPlatformV7ExecutionObservabilitySummary(signals)).toMatchObject({
      total: 2,
      critical: 0,
      warnings: 0,
      runtimeAlerts: 0,
      operatorReview: 0,
      mode: 'contract_only_requires_observability_runtime',
    });
  });

  it('creates critical signal for blocked money-sensitive boundary', () => {
    const gate = checkPlatformV7ExecutionGate({
      boundaryId: 'confirm_money_released',
      actorId: 'driver-1',
      actorRole: 'driver',
      entityId: 'money-1',
      entityType: 'money_record',
      payload: {
        dealId: 'deal-1',
        amountMinor: 100,
        currency: 'RUB',
        bankReferenceId: 'BANK-REF-1',
        confirmedAt: '2026-05-07T10:00:00.000Z',
      },
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Boundary recorded.',
    });

    const result = buildPlatformV7ExecutionResult(gate);
    const signals = buildPlatformV7ExecutionObservabilitySignals(result);

    expect(signals.map((signal) => signal.kind)).toContain('execution_money_boundary');
    expect(hasPlatformV7CriticalExecutionSignal(signals)).toBe(true);
    expect(getPlatformV7ExecutionObservabilitySummary(signals)).toMatchObject({
      critical: 1,
      runtimeAlerts: 1,
      operatorReview: signals.filter((signal) => signal.requiresOperatorReview).length,
    });
  });

  it('keeps payload issues visible as operator-review signals', () => {
    const gate = checkPlatformV7ExecutionGate({
      boundaryId: 'confirm_money_released',
      actorId: 'bank-1',
      actorRole: 'bank',
      entityId: 'money-1',
      entityType: 'money_record',
      payload: {
        dealId: 'deal-1',
        currency: 'RUB',
        confirmedAt: '2026-05-07T10:00:00.000Z',
      },
      occurredAt: '2026-05-07T10:00:00.000Z',
      summary: 'Incomplete boundary.',
    });

    const result = buildPlatformV7ExecutionResult(gate);
    const signals = buildPlatformV7ExecutionObservabilitySignals(result);
    const payloadSignals = signals.filter((signal) => signal.kind === 'execution_payload_issue');

    expect(payloadSignals.length).toBeGreaterThan(0);
    expect(payloadSignals.every((signal) => signal.requiresOperatorReview)).toBe(true);
    expect(payloadSignals.every((signal) => signal.severity === 'warning')).toBe(true);
  });
});
