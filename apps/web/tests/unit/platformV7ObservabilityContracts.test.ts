import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_CRITICAL_SIGNALS,
  PLATFORM_V7_REQUIRED_FEATURE_FLAGS,
  PLATFORM_V7_REQUIRED_KILL_SWITCHES,
  PLATFORM_V7_REQUIRED_OBSERVABILITY_SIGNALS,
  classifyPlatformV7Signal,
  requiresPlatformV7OperatorAction,
} from '@/lib/platform-v7/observability-contracts';

describe('platform-v7 observability contracts', () => {
  it('keeps required observability signals explicit', () => {
    expect(PLATFORM_V7_REQUIRED_OBSERVABILITY_SIGNALS).toContain('frontend_error');
    expect(PLATFORM_V7_REQUIRED_OBSERVABILITY_SIGNALS).toContain('integration_request');
    expect(PLATFORM_V7_REQUIRED_OBSERVABILITY_SIGNALS).toContain('integration_response');
    expect(PLATFORM_V7_REQUIRED_OBSERVABILITY_SIGNALS).toContain('money_mismatch');
    expect(PLATFORM_V7_REQUIRED_OBSERVABILITY_SIGNALS).toContain('sla_breach');
    expect(PLATFORM_V7_REQUIRED_OBSERVABILITY_SIGNALS).toContain('deployment_health');
    expect(PLATFORM_V7_REQUIRED_OBSERVABILITY_SIGNALS).toContain('kill_switch_triggered');
  });

  it('classifies money and bank incidents as critical', () => {
    expect(PLATFORM_V7_CRITICAL_SIGNALS).toContain('money_mismatch');
    expect(PLATFORM_V7_CRITICAL_SIGNALS).toContain('manual_reconciliation_required');
    expect(PLATFORM_V7_CRITICAL_SIGNALS).toContain('bank_action_requested');
    expect(classifyPlatformV7Signal('money_mismatch')).toBe('critical');
    expect(requiresPlatformV7OperatorAction('money_mismatch')).toBe(true);
  });

  it('keeps flags and kill switches ready for controlled pilot operation', () => {
    expect(PLATFORM_V7_REQUIRED_FEATURE_FLAGS.map((flag) => flag.key)).toEqual([
      'platform_v7_money_actions',
      'platform_v7_external_connectors',
      'platform_v7_auction_flow',
      'platform_v7_driver_field_shell',
      'platform_v7_support_operator_queue',
    ]);

    expect(PLATFORM_V7_REQUIRED_KILL_SWITCHES.map((item) => item.key)).toEqual([
      'disable_money_actions',
      'disable_external_integrations',
      'disable_document_signing',
      'disable_auction_flow',
      'disable_platform_v7',
    ]);
  });
});
