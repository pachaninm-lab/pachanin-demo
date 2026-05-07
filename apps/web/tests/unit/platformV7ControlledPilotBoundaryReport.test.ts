import { describe, expect, it } from 'vitest';
import {
  buildPlatformV7ControlledPilotBoundaryReport,
  canPlatformV7BoundaryReportClaimProductionMaturity,
  getPlatformV7BoundaryReportCompactSummary,
} from '@/lib/platform-v7/controlled-pilot-boundary-report';

describe('platform-v7 controlled pilot boundary report', () => {
  it('keeps the final report in controlled-pilot contract-layer status', () => {
    const report = buildPlatformV7ControlledPilotBoundaryReport();

    expect(report.status).toBe('controlled_pilot_contract_layer');
    expect(report.canClaimProductionMaturity).toBe(false);
    expect(report.canClaimLiveConnectors).toBe(false);
    expect(report.canClaimRealMoneyMovement).toBe(false);
    expect(report.canClaimRealExecution).toBe(false);
    expect(report.runtimeReadiness.status).toBe('contract_only');
  });

  it('exposes boundary and payload summaries without claiming runtime', () => {
    const report = buildPlatformV7ControlledPilotBoundaryReport();

    expect(report.apiBoundaries.mode).toBe('contract_only_requires_server_routes');
    expect(report.payloadBoundaries.mode).toBe('contract_only_requires_validation_runtime');
    expect(report.canClaimServerRuntime).toBe(false);
  });

  it('blocks maturity overclaims by code without storing forbidden copy strings', () => {
    const report = buildPlatformV7ControlledPilotBoundaryReport();

    expect(report.forbiddenClaimCodes).toHaveLength(8);
    expect(report.forbiddenClaimCodes).toContain('production_maturity_overclaim');
    expect(report.forbiddenClaimCodes).toContain('real_money_movement_overclaim');
    expect(report.forbiddenClaimCodes).toContain('external_confirmation_overclaim');
    expect(canPlatformV7BoundaryReportClaimProductionMaturity(report)).toBe(false);
  });

  it('lists runtime prerequisites that remain outside the contract-layer pass', () => {
    const report = buildPlatformV7ControlledPilotBoundaryReport();

    expect(report.nextRuntimePrerequisites).toContain('server routes');
    expect(report.nextRuntimePrerequisites).toContain('durable persistence');
    expect(report.nextRuntimePrerequisites).toContain('external confirmation boundaries');
  });

  it('returns compact report summary', () => {
    expect(getPlatformV7BoundaryReportCompactSummary()).toEqual({
      status: 'controlled_pilot_contract_layer',
      canClaimProductionMaturity: false,
      canClaimServerRuntime: false,
      canClaimRealExecution: false,
      runtimeStatus: 'contract_only',
      missingCriticalCount: 8,
      missingMoneyCriticalCount: 12,
    });
  });
});
