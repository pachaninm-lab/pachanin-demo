import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_EXECUTION_SERVICE_NAMES,
  isPlatformV7ExecutionServiceName,
} from '@/lib/platform-v7/execution-service-registry-contract';

describe('platform-v7 execution service registry', () => {
  it('recognizes registered execution services', () => {
    for (const serviceName of PLATFORM_V7_EXECUTION_SERVICE_NAMES) {
      expect(isPlatformV7ExecutionServiceName(serviceName)).toBe(true);
    }
  });

  it('rejects services outside the execution registry', () => {
    expect(isPlatformV7ExecutionServiceName('')).toBe(false);
    expect(isPlatformV7ExecutionServiceName('unknown')).toBe(false);
  });
});
