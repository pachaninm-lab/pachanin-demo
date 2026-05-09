import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_ROLE_BLOCKED_ROUTE_PREFIXES,
  PLATFORM_V7_ROLE_FORBIDDEN_FIELDS,
  PLATFORM_V7_ROLE_FORBIDDEN_SURFACES,
  PLATFORM_V7_ROLE_HOME_ROUTE,
} from '@/lib/platform-v7/role-access';

const sortedKeys = (value: Record<string, unknown>) => Object.keys(value).sort();

describe('platform-v7 role policy registries', () => {
  it('keeps route, surface, and field policy registries aligned by role', () => {
    const roles = sortedKeys(PLATFORM_V7_ROLE_HOME_ROUTE);

    expect(sortedKeys(PLATFORM_V7_ROLE_BLOCKED_ROUTE_PREFIXES)).toEqual(roles);
    expect(sortedKeys(PLATFORM_V7_ROLE_FORBIDDEN_SURFACES)).toEqual(roles);
    expect(sortedKeys(PLATFORM_V7_ROLE_FORBIDDEN_FIELDS)).toEqual(roles);
  });
});
