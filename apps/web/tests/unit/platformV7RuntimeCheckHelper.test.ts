import { describe, expect, it } from 'vitest';
import {
  assessPlatformV7RuntimeReadiness,
  getPlatformV7RuntimeReadinessSummary,
  markPlatformV7RuntimeChecksReady,
  PLATFORM_V7_RUNTIME_CHECKS,
} from '@/lib/platform-v7/runtime-check-helper';

describe('platform-v7 runtime check helper', () => {
  it('keeps default readiness contract-only', () => {
    const result = assessPlatformV7RuntimeReadiness();

    expect(result.status).toBe('contract_only');
    expect(result.canRunServerActions).toBe(false);
    expect(result.canAffectMoney).toBe(false);
    expect(result.canClaimRealExecution).toBe(false);
    expect(result.missingCritical).toEqual([
      'server_routes',
      'auth',
      'rbac',
      'entity_acl',
      'persistence',
      'append_only_audit',
      'idempotency_store',
      'transaction_state_store',
      'trip_runtime',
    ]);
  });

  it('keeps trip runtime blocked until server-backed trip state and audit are ready', () => {
    const checks = markPlatformV7RuntimeChecksReady([
      'server_routes',
      'auth',
      'rbac',
      'entity_acl',
      'persistence',
      'append_only_audit',
      'idempotency_store',
      'transaction_state_store',
    ]);

    const result = assessPlatformV7RuntimeReadiness(checks);

    expect(result.status).toBe('contract_only');
    expect(result.canRunServerActions).toBe(false);
    expect(result.missingCritical).toEqual(['trip_runtime']);
  });

  it('allows non-money runtime consideration only after critical checks are ready', () => {
    const checks = markPlatformV7RuntimeChecksReady([
      'server_routes',
      'auth',
      'rbac',
      'entity_acl',
      'persistence',
      'append_only_audit',
      'idempotency_store',
      'transaction_state_store',
      'trip_runtime',
    ]);

    const result = assessPlatformV7RuntimeReadiness(checks);

    expect(result.status).toBe('runtime_blocked');
    expect(result.canRunServerActions).toBe(true);
    expect(result.canAffectMoney).toBe(false);
    expect(result.canClaimRealExecution).toBe(false);
    expect(result.missingMoneyCritical).toEqual([
      'money_reconciliation',
      'observability',
      'feature_flags',
      'kill_switches',
      'external_confirmation_boundary',
    ]);
  });

  it('keeps real execution claim false even when all checks are ready', () => {
    const allIds = PLATFORM_V7_RUNTIME_CHECKS.map((check) => check.id);
    const checks = markPlatformV7RuntimeChecksReady(allIds);
    const result = assessPlatformV7RuntimeReadiness(checks);

    expect(result.status).toBe('controlled_runtime_ready');
    expect(result.canRunServerActions).toBe(true);
    expect(result.canAffectMoney).toBe(true);
    expect(result.canClaimRealExecution).toBe(false);
    expect(result.missingCritical).toEqual([]);
    expect(result.missingMoneyCritical).toEqual([]);
  });

  it('returns compact readiness summary', () => {
    const result = assessPlatformV7RuntimeReadiness();

    expect(getPlatformV7RuntimeReadinessSummary(result)).toEqual({
      status: 'contract_only',
      canRunServerActions: false,
      canAffectMoney: false,
      canClaimRealExecution: false,
      missingCriticalCount: 9,
      missingMoneyCriticalCount: 13,
      manualReviewCount: 1,
    });
  });
});
