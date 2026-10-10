import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  platformV7CommandNavByRole,
  platformV7NavByRole,
  platformV7RoleCanOpenHref,
} from '@/lib/platform-v7/shellRoutes';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const logisticsPage = read('apps/web/app/platform-v7/logistics/page.tsx');
const logisticsDriversPage = read('apps/web/app/platform-v7/logistics/drivers/page.tsx');
const driverLayout = read('apps/web/app/platform-v7/driver/layout.tsx');

describe('platform-v7 logistics and driver role boundary', () => {
  it('does not permit the logistics role to open the driver field cabinet', () => {
    expect(platformV7RoleCanOpenHref('logistics', '/platform-v7/driver/field')).toBe(false);
    expect(platformV7RoleCanOpenHref('logistics', '/platform-v7/logistics/drivers')).toBe(true);
    expect(platformV7RoleCanOpenHref('driver', '/platform-v7/logistics')).toBe(false);
  });

  it('keeps logistics navigation inside logistics-owned routes', () => {
    const logisticsLinks = [
      ...platformV7NavByRole('logistics'),
      ...platformV7CommandNavByRole('logistics'),
    ];
    expect(logisticsLinks.some((item) => item.href.startsWith('/platform-v7/driver'))).toBe(false);
    expect(logisticsLinks.some((item) => item.href === '/platform-v7/logistics/drivers')).toBe(true);
  });

  it('removes direct driver-cabinet links from the logistics dashboard', () => {
    // Widened from /driver/field to the whole driver cabinet. The narrow form
    // is what let a handoff link to /platform-v7/driver sit here unnoticed: it
    // was not /driver/field, so it passed, and a logistician following it was
    // bounced straight back out by the cabinet layout.
    expect(logisticsPage).not.toMatch(/href[=:]\s*'\/platform-v7\/driver(?:'|\/)/u);
    // Either JSX attribute or object form - the boundary is where the link
    // points, not which syntax declares it.
    expect(logisticsPage).toMatch(/href[=:]\s*'\/platform-v7\/logistics\/drivers'/u);
    expect(logisticsPage).toMatch(/href[=:]\s*'\/platform-v7\/deal-logistics'/u);
  });

  it('provides a separate dispatcher view for managing drivers', () => {
    // The sentence this pinned was replaced by a boundary statement that says
    // considerably more: the logistician reads server-side assignments, and
    // every mutation is a separately authorized command with RBAC, idempotency
    // and audit. Asserting that keeps the screen from drifting back into a
    // local, editable driver list.
    expect(logisticsDriversPage).toContain('Логист просматривает серверные назначения');
    expect(logisticsDriversPage).toContain('RBAC, идемпотентностью и аудитом');
    expect(logisticsDriversPage).toContain('/logistics/shipments');
    expect(logisticsDriversPage).not.toMatch(/'\/platform-v7\/driver(?:'|\/)/u);
  });

  it('enforces the driver cabinet from a verified server session', () => {
    expect(driverLayout).toContain('readVerifiedCabinetSessionRole');
    expect(driverLayout).toContain('readVerifiedCabinetRole');
    expect(driverLayout).toContain("verifiedRole !== 'driver'");
    // The redirect gained an organization special case, so the exact call is no
    // longer a single literal. What must hold is that a verified role which is
    // not driver is sent to its own route, and that an absent role is sent to
    // login rather than rendered.
    expect(driverLayout).toContain('platformV7RoleRoute(verifiedRole)');
    expect(driverLayout).toMatch(/if \(!verifiedRole\)\s*\{\s*redirect\(/u);
    expect(driverLayout).not.toContain('pc-role');
    expect(driverLayout).not.toContain('<RbacGuard');
  });
});
