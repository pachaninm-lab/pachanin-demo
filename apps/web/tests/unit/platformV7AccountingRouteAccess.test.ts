import { describe, expect, it } from 'vitest';
import { canRoleAccessCabinet } from '../../lib/platform-v7/cabinet-access-policy';
import { isDesignSystemV8Route } from '../../lib/platform-v7/design-system-v8-route-policy';
import { platformV7RoleCanOpenHref } from '../../lib/platform-v7/shellRoutes';

/**
 * Who can open the accounting surface, and whether it is reachable at all.
 *
 * The second question is not rhetorical. `apps/web/app/platform-v7/layout.tsx`
 * calls `notFound()` for any path the route policy does not know, before it
 * ever looks at a role — so a page that exists on disk and is absent from the
 * policy is a 404 with a file behind it. That is exactly what the accounting
 * board was until the route was registered, and this test is what fails if the
 * registration is lost again.
 *
 * The role fence here is the coarse one. The server decides for real: the API
 * answers 403 for a membership without accounting capability, and no client
 * list can grant what the server refuses. This one exists so a role that will
 * be refused anyway is not walked into a dead screen first.
 */

const ACCOUNTING = '/platform-v7/accounting';
const DEAL_ACCOUNTING = '/platform-v7/deals/D-2026-1/accounting';

describe('platform-v7 accounting route access', () => {
  it('registers both accounting routes in the design system v8 route class', () => {
    expect(isDesignSystemV8Route(ACCOUNTING)).toBe(true);
    expect(isDesignSystemV8Route(DEAL_ACCOUNTING)).toBe(true);
  });

  it('lets the roles that carry accounting work open the surface', () => {
    for (const role of ['seller', 'buyer'] as const) {
      expect(platformV7RoleCanOpenHref(role, ACCOUNTING)).toBe(true);
      expect(canRoleAccessCabinet(role, ACCOUNTING)).toBe(true);
      expect(canRoleAccessCabinet(role, DEAL_ACCOUNTING)).toBe(true);
    }
  });

  it('keeps oversight roles able to open it without a per-role entry', () => {
    for (const role of ['operator', 'executive'] as const) {
      expect(canRoleAccessCabinet(role, ACCOUNTING)).toBe(true);
    }
  });

  it('does not hand the surface to field roles that have no accounting work', () => {
    for (const role of ['driver', 'lab', 'surveyor'] as const) {
      expect(canRoleAccessCabinet(role, ACCOUNTING)).toBe(false);
    }
  });
});
