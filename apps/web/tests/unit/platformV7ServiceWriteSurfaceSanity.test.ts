import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_SERVICE_WRITE_METHODS } from '@/lib/platform-v7/service-contracts';

describe('platform-v7 service write surface sanity', () => {
  it('keeps write methods unique within each service', () => {
    for (const [serviceName, methodNames] of Object.entries(PLATFORM_V7_SERVICE_WRITE_METHODS)) {
      expect(new Set(methodNames).size, serviceName).toBe(methodNames.length);
    }
  });

  it('keeps write method names stable and clean', () => {
    for (const methodName of Object.values(PLATFORM_V7_SERVICE_WRITE_METHODS).flat()) {
      expect(methodName.trim(), methodName).toBe(methodName);
      expect(methodName, methodName).toMatch(/^[a-z][A-Za-z0-9]*$/);
    }
  });

  it('keeps read prefixes out of explicit write methods', () => {
    const methodNames = Object.values(PLATFORM_V7_SERVICE_WRITE_METHODS).flat();

    for (const prefix of ['get', 'list', 'read']) {
      expect(methodNames.some((methodName) => methodName.toLowerCase().startsWith(prefix))).toBe(false);
    }
  });
});
