import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CONNECTION_CENTER_ROUTE,
  canRoleAccessCabinet,
} from '../../lib/platform-v7/cabinet-access-policy';
import { isDesignSystemV8Route } from '../../lib/platform-v7/design-system-v8-route-policy';
import { mapApiRoleToCabinetRole } from '../../lib/platform-v7/verified-session';

const CONNECTIONS = '/platform-v7/settings/connections';

describe('platform-v7 Connection Center route access', () => {
  it('registers only the exact Connection Center route, not a generic settings prefix', () => {
    expect(CONNECTION_CENTER_ROUTE).toBe(CONNECTIONS);
    expect(isDesignSystemV8Route(CONNECTIONS)).toBe(true);
    expect(isDesignSystemV8Route('/platform-v7/settings')).toBe(false);
    expect(isDesignSystemV8Route('/platform-v7/settings/secrets')).toBe(false);
    expect(isDesignSystemV8Route('/platform-v7/settings/connections/credentials')).toBe(false);
  });

  it('admits the business/oversight cabinets that can legitimately need connection status', () => {
    for (const role of ['seller', 'buyer', 'operator', 'compliance', 'executive'] as const) {
      expect(canRoleAccessCabinet(role, CONNECTIONS), role).toBe(true);
    }
  });

  it('keeps field-only roles out before the server capability check', () => {
    for (const role of ['driver', 'lab', 'surveyor'] as const) {
      expect(canRoleAccessCabinet(role, CONNECTIONS), role).toBe(false);
    }
  });

  it('preserves GUEST as the organization cabinet role for accountant job profiles', () => {
    expect(mapApiRoleToCabinetRole('GUEST')).toBe('organization');
  });

  it('lets the organization cabinet render the exact Connection Center page', () => {
    const layoutPath = fileURLToPath(
      new URL('../../app/platform-v7/layout.tsx', import.meta.url),
    );
    const source = readFileSync(layoutPath, 'utf8');
    const organizationBlock = source.slice(
      source.indexOf('const ORGANIZATION_CABINET_PREFIXES'),
      source.indexOf('const AUTH_PATHS'),
    );
    expect(organizationBlock).toContain("'/platform-v7/settings/connections'");
    expect(organizationBlock).not.toContain("'/platform-v7/settings',");
  });
});
