import { describe, expect, it } from 'vitest';
import {
  doesPlatformV7ExecutionRegistryRequireTripBoundary,
  hasOnlyNamedPlatformV7ExecutionServices,
  hasUniquePlatformV7ExecutionServiceNames,
  isPlatformV7ExecutionServiceName,
  PLATFORM_V7_EXECUTION_SERVICE_NAMES,
} from '@/lib/platform-v7/execution-service-registry-contract';

const EXPECTED_EXECUTION_SERVICES = [
  'batch',
  'lot',
  'rfq',
  'proposal',
  'deal',
  'money',
  'document',
  'logistics',
  'dispute',
  'support',
  'rating',
  'audit',
  'notification',
  'integrations',
  'trip',
] as const;

describe('platform-v7 execution service registry contract', () => {
  it('keeps the execution service list explicit', () => {
    expect(PLATFORM_V7_EXECUTION_SERVICE_NAMES).toEqual(EXPECTED_EXECUTION_SERVICES);
  });

  it('keeps execution service names unique and non-empty', () => {
    expect(hasUniquePlatformV7ExecutionServiceNames()).toBe(true);
    expect(hasOnlyNamedPlatformV7ExecutionServices()).toBe(true);
    expect(hasUniquePlatformV7ExecutionServiceNames(['deal', 'deal'])).toBe(false);
    expect(hasOnlyNamedPlatformV7ExecutionServices(['deal', ' '])).toBe(false);
  });

  it('keeps trip as an explicit execution boundary', () => {
    expect(doesPlatformV7ExecutionRegistryRequireTripBoundary()).toBe(true);
    expect(doesPlatformV7ExecutionRegistryRequireTripBoundary(['deal', 'money'])).toBe(false);
  });

  it('recognizes only registered execution services', () => {
    for (const serviceName of EXPECTED_EXECUTION_SERVICES) {
      expect(isPlatformV7ExecutionServiceName(serviceName)).toBe(true);
    }

    expect(isPlatformV7ExecutionServiceName('marketplace')).toBe(false);
    expect(isPlatformV7ExecutionServiceName('domain-core')).toBe(false);
    expect(isPlatformV7ExecutionServiceName('')).toBe(false);
  });
});
