import { describe, expect, it } from 'vitest';
import { getPlatformV7ActionPermissionPolicy } from '@/lib/platform-v7/action-permission-boundary';
import { getPlatformV7ActionForApiBoundary, PLATFORM_V7_API_ACTION_MAP } from '@/lib/platform-v7/api-action-map';
import { getPlatformV7ApiBoundary } from '@/lib/platform-v7/api-boundary-contracts';
import { getPlatformV7ActionServiceName } from '@/lib/platform-v7/action-service-map';

describe('platform-v7 api action map', () => {
  it('maps write api boundaries to action permission policies', () => {
    for (const [boundaryId, actionId] of Object.entries(PLATFORM_V7_API_ACTION_MAP)) {
      expect(getPlatformV7ApiBoundary(boundaryId as keyof typeof PLATFORM_V7_API_ACTION_MAP)).toBeDefined();
      expect(getPlatformV7ActionPermissionPolicy(actionId)).toBeDefined();
    }
  });

  it('keeps the dispute close api unmapped until the action boundary is reviewed', () => {
    expect(getPlatformV7ApiBoundary('resolve_dispute')).toBeDefined();
    expect(getPlatformV7ActionForApiBoundary('resolve_dispute')).toBeUndefined();
  });

  it('keeps driver trip arrival api tied to driver checkpoint and trip service', () => {
    const actionId = getPlatformV7ActionForApiBoundary('mark_trip_arrived');

    expect(actionId).toBe('driver.confirm_checkpoint');
    expect(actionId ? getPlatformV7ActionServiceName(actionId) : undefined).toBe('trip');
  });

  it('keeps trip incident api tied to trip action and trip service', () => {
    const actionId = getPlatformV7ActionForApiBoundary('open_incident');

    expect(actionId).toBe('trip.open_incident');
    expect(actionId ? getPlatformV7ActionServiceName(actionId) : undefined).toBe('trip');
  });

  it('keeps money api boundaries tied to money actions and money service', () => {
    expect(getPlatformV7ActionForApiBoundary('request_money_reserve')).toBe('money.request_reserve');
    expect(getPlatformV7ActionForApiBoundary('confirm_money_reserved')).toBe('bank.confirm_money_reserved');
    expect(getPlatformV7ActionForApiBoundary('mark_money_ready_to_release')).toBe('bank.mark_money_ready_to_release');
    expect(getPlatformV7ActionForApiBoundary('confirm_money_released')).toBe('bank.confirm_money_released');

    for (const boundaryId of [
      'request_money_reserve',
      'confirm_money_reserved',
      'mark_money_ready_to_release',
      'confirm_money_released',
    ] as const) {
      const actionId = getPlatformV7ActionForApiBoundary(boundaryId);
      expect(actionId ? getPlatformV7ActionServiceName(actionId) : undefined).toBe('money');
    }
  });
});
