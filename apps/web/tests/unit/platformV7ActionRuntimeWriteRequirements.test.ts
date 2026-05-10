import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_ACTION_PERMISSION_POLICIES,
  PLATFORM_V7_ACTION_RUNTIME_REQUIREMENTS,
} from '@/lib/platform-v7/action-permission-boundary';
import {
  doesPlatformV7ServiceExposeWriteMethods,
  PLATFORM_V7_REQUIRED_SERVICE_NAMES,
  type PlatformV7RequiredServiceName,
} from '@/lib/platform-v7/service-contracts';
import {
  doesPlatformV7TripServiceExposeWriteMethods,
  getPlatformV7TripServiceWriteMethods,
  PLATFORM_V7_TRIP_SERVICE_NAME,
} from '@/lib/platform-v7/trip-service-contract';

const requiredServiceNames = new Set<string>(PLATFORM_V7_REQUIRED_SERVICE_NAMES);

describe('platform-v7 action runtime write requirements', () => {
  it('keeps every action policy explicitly gated by durable write, audit and idempotency', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(policy.needsDurableWrite, `${policy.actionId}:durable-write`).toBe(
        PLATFORM_V7_ACTION_RUNTIME_REQUIREMENTS.needsDurableWrite,
      );
      expect(policy.needsAuditEvent, `${policy.actionId}:audit`).toBe(
        PLATFORM_V7_ACTION_RUNTIME_REQUIREMENTS.needsAuditEvent,
      );
      expect(policy.needsIdempotencyKey, `${policy.actionId}:idempotency`).toBe(
        PLATFORM_V7_ACTION_RUNTIME_REQUIREMENTS.needsIdempotencyKey,
      );
    }
  });

  it('does not allow action policies to point at services without write methods', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      if (policy.serviceName === PLATFORM_V7_TRIP_SERVICE_NAME) {
        expect(
          doesPlatformV7TripServiceExposeWriteMethods(),
          `${policy.actionId}:trip:write-surface`,
        ).toBe(true);
        expect(
          getPlatformV7TripServiceWriteMethods().length,
          `${policy.actionId}:trip:write-methods`,
        ).toBeGreaterThan(0);
        continue;
      }

      expect(requiredServiceNames.has(policy.serviceName), `${policy.actionId}:${policy.serviceName}`).toBe(true);
      expect(
        doesPlatformV7ServiceExposeWriteMethods(policy.serviceName as PlatformV7RequiredServiceName),
        `${policy.actionId}:${policy.serviceName}`,
      ).toBe(true);
    }
  });
});
