import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleRunCommand,
  getPlatformV7ExecutionCommand,
  getPlatformV7ExecutionCommandReadinessSummary,
  getPlatformV7ExecutionCommandsForEntity,
  getPlatformV7ExecutionCommandsForRole,
  getPlatformV7MoneyAffectingExecutionCommands,
  PLATFORM_V7_EXECUTION_COMMANDS,
} from '@/lib/platform-v7/execution-command-contracts';

describe('platform-v7 execution command contracts', () => {
  it('keeps command layer explicitly contract-only', () => {
    expect(getPlatformV7ExecutionCommandReadinessSummary()).toMatchObject({
      total: 18,
      requiringAudit: 18,
      requiringIdempotency: 18,
      mode: 'contract_only_requires_action_runtime',
    });
  });

  it('keeps money-sensitive commands audit-bound, idempotent and deal-bound', () => {
    const moneyAffecting = getPlatformV7MoneyAffectingExecutionCommands();

    expect(moneyAffecting.length).toBeGreaterThan(6);
    expect(moneyAffecting.every((command) => command.affectsMoney)).toBe(true);
    expect(moneyAffecting.every((command) => command.requiresAuditEvent)).toBe(true);
    expect(moneyAffecting.every((command) => command.requiresIdempotencyKey)).toBe(true);
    expect(moneyAffecting.every((command) => command.requiresDealId)).toBe(true);
  });

  it('keeps driver limited to field execution commands', () => {
    const driverCommands = getPlatformV7ExecutionCommandsForRole('driver').map((command) => command.id);

    expect(driverCommands).toEqual(['mark_trip_arrived', 'open_incident']);
    expect(canPlatformV7RoleRunCommand('driver', 'confirm_money_released')).toBe(false);
    expect(canPlatformV7RoleRunCommand('driver', 'confirm_money_reserved')).toBe(false);
    expect(canPlatformV7RoleRunCommand('driver', 'resolve_dispute')).toBe(false);
  });

  it('keeps bank commands restricted to money and dispute decision boundaries', () => {
    const bankCommands = getPlatformV7ExecutionCommandsForRole('bank').map((command) => command.id);

    expect(bankCommands).toEqual(['confirm_money_reserved', 'resolve_dispute', 'mark_money_ready_to_release', 'confirm_money_released']);
    expect(canPlatformV7RoleRunCommand('bank', 'publish_lot')).toBe(false);
    expect(canPlatformV7RoleRunCommand('bank', 'assign_driver')).toBe(false);
  });

  it('maps commands to state entities and persistence entities', () => {
    expect(getPlatformV7ExecutionCommandsForEntity('money').map((command) => command.id)).toEqual([
      'request_money_reserve',
      'confirm_money_reserved',
      'mark_money_ready_to_release',
      'confirm_money_released',
    ]);
    expect(getPlatformV7ExecutionCommand('confirm_money_released')).toMatchObject({
      entity: 'money',
      from: 'ready_to_release',
      to: 'released',
      guard: 'external_confirmation_required',
      persistenceEntity: 'money_record',
    });
  });

  it('does not expose commands without labels or summaries', () => {
    expect(PLATFORM_V7_EXECUTION_COMMANDS.every((command) => command.label.length > 0)).toBe(true);
    expect(PLATFORM_V7_EXECUTION_COMMANDS.every((command) => command.summary.length > 0)).toBe(true);
  });
});
