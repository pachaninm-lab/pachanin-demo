import { describe, expect, it } from 'vitest';
import { platformV7CommandSectionItems } from '@/lib/platform-v7/command';
import { PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES } from '@/lib/platform-v7/routes';

describe('platform-v7 execution machine route contract', () => {
  it('keeps every read-only execution machine screen discoverable through command registry', () => {
    const commandHrefs = platformV7CommandSectionItems().map((item) => item.href);

    expect(new Set(PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES).size).toBe(PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES.length);

    for (const route of PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES) {
      expect(commandHrefs, `${route} must be exposed in command navigation`).toContain(route);
    }
  });

  it('keeps execution machine strip routes scoped to platform-v7 without live or api endpoints', () => {
    for (const route of PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES) {
      expect(route).toMatch(/^\/platform-v7\//);
      expect(route).not.toContain('/api/');
      expect(route).not.toContain('/live');
    }
  });
});
