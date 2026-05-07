import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_DRIVER_FORBIDDEN_ENTITIES,
  PLATFORM_V7_SENSITIVE_PERMISSIONS,
  canPlatformV7Role,
} from '@/lib/platform-v7/security-contracts';

describe('platform-v7 security contracts', () => {
  it('keeps driver field scope away from money and commercial entities', () => {
    expect(PLATFORM_V7_DRIVER_FORBIDDEN_ENTITIES).toEqual([
      'money',
      'proposal',
      'rfq',
      'rating',
      'connector',
      'audit_event',
    ]);

    expect(canPlatformV7Role('driver', 'money', 'view_money')).toMatchObject({
      allowed: false,
      reason: 'driver_field_scope_only',
      requiresAudit: true,
    });

    expect(canPlatformV7Role('driver', 'trip', 'update')).toMatchObject({
      allowed: true,
      reason: 'allowed_by_role_policy',
    });
  });

  it('keeps sensitive permissions auditable', () => {
    expect(PLATFORM_V7_SENSITIVE_PERMISSIONS).toContain('request_bank_action');
    expect(PLATFORM_V7_SENSITIVE_PERMISSIONS).toContain('resolve_dispute');
    expect(canPlatformV7Role('bank', 'money', 'request_bank_action')).toMatchObject({
      allowed: true,
      requiresAudit: true,
    });
    expect(canPlatformV7Role('seller', 'money', 'request_bank_action')).toMatchObject({
      allowed: false,
      requiresAudit: true,
    });
  });

  it('does not give investor operational write access', () => {
    expect(canPlatformV7Role('investor', 'money', 'request_bank_action')).toMatchObject({
      allowed: false,
      requiresAudit: true,
    });
    expect(canPlatformV7Role('investor', 'rating', 'read')).toMatchObject({
      allowed: true,
    });
  });
});
