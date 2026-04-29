import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_COMMAND_ROUTE_SURFACE,
  PLATFORM_V7_SHELL_ROUTE_SURFACE,
} from '@/lib/platform-v7/routes';
import { platformV7ShellRouteSurface } from '@/lib/platform-v7/shellRoutes';

const forbiddenFamilies = ['/platform-v4', '/platform-v9'];

describe('platform-v7 shell route forbidden families', () => {
  it('keeps command route surface away from old platform families', () => {
    for (const route of PLATFORM_V7_COMMAND_ROUTE_SURFACE) {
      for (const family of forbiddenFamilies) {
        expect(route.includes(family)).toBe(false);
      }
    }
  });

  it('keeps shell route surface away from old platform families', () => {
    for (const route of PLATFORM_V7_SHELL_ROUTE_SURFACE) {
      for (const family of forbiddenFamilies) {
        expect(route.includes(family)).toBe(false);
      }
    }
  });

  it('keeps shell route registry away from old platform families', () => {
    for (const route of platformV7ShellRouteSurface()) {
      for (const family of forbiddenFamilies) {
        expect(route.includes(family)).toBe(false);
      }
    }
  });
});
