// Exact-head admission refresh after provider-maintenance #5238; test semantics unchanged.
// Temporary pull_request paths trigger; removed in the immediately following commit.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isControlRealmPathAllowed,
  OWNER_CONTROLLED_CABINET_TARGETS,
  ownerCabinetSessionMatchesRoot,
  ownerControlledCabinetRole,
} from '@/lib/platform-v7/control-host';
import { controlledCabinetContext } from '@/lib/platform-v7/controlled-test-organizations';

function source(path: string) {
  const root = process.cwd().endsWith('/apps/web')
    ? resolve(process.cwd(), '..', '..')
    : process.cwd();
  return readFileSync(resolve(root, path), 'utf8');
}

const middleware = source('apps/web/middleware.ts');

type Role = keyof typeof OWNER_CONTROLLED_CABINET_TARGETS;

describe('Company OS owner cabinet control-host gate', () => {
  it('has thirteen exact canonical roots and no legacy operator alias', () => {
    expect(Object.keys(OWNER_CONTROLLED_CABINET_TARGETS)).toHaveLength(13);
    expect(OWNER_CONTROLLED_CABINET_TARGETS.operator).toBe('/platform-v7/operator');
    expect(OWNER_CONTROLLED_CABINET_TARGETS.executive).toBe('/platform-v7/executive');
    expect(ownerControlledCabinetRole('/platform-v7/control-tower')).toBeNull();
    expect(ownerControlledCabinetRole('/platform-v7/operator/anything')).toBeNull();
    expect(isControlRealmPathAllowed('/platform-v7/control-tower')).toBe(false);
  });

  it('accepts only a signed owner session bound to the exact root role and fixed organization/tenant', () => {
    for (const role of Object.keys(OWNER_CONTROLLED_CABINET_TARGETS) as Role[]) {
      const pathname = OWNER_CONTROLLED_CABINET_TARGETS[role];
      const expected = controlledCabinetContext(role);
      if (!expected) throw new Error(`missing controlled context for ${role}`);

      const valid = {
        role,
        ownerAccess: true,
        organizationId: expected.organizationId,
        tenantId: expected.tenantId,
      };
      expect(ownerCabinetSessionMatchesRoot(pathname, valid, expected), role).toBe(true);
      expect(ownerCabinetSessionMatchesRoot(pathname, null, expected), `${role}: missing`).toBe(false);
      expect(ownerCabinetSessionMatchesRoot(pathname, { ...valid, ownerAccess: false }, expected), `${role}: non-owner`).toBe(false);
      expect(ownerCabinetSessionMatchesRoot(pathname, { ...valid, role: role === 'buyer' ? 'seller' : 'buyer' }, expected), `${role}: mismatched role`).toBe(false);
      expect(ownerCabinetSessionMatchesRoot(pathname, { ...valid, organizationId: 'org-wrong' }, expected), `${role}: wrong org`).toBe(false);
      expect(ownerCabinetSessionMatchesRoot(pathname, { ...valid, tenantId: 'tenant-wrong' }, expected), `${role}: wrong tenant`).toBe(false);
      expect(ownerCabinetSessionMatchesRoot(`${pathname}/deep`, valid, expected), `${role}: deep route`).toBe(false);
    }
  });

  it('wires the signed cookie verification before the root response and leaves the broad allowlist unchanged', () => {
    expect(middleware).toContain('ownerControlledRootAllowed');
    expect(middleware).toContain('readVerifiedCabinetSessionContext');
    expect(middleware).toContain('CABINET_SESSION_COOKIE');
    expect(middleware).toContain('ownerCabinetSessionMatchesRoot');
    expect(middleware).toContain('if (!(await ownerControlledRootAllowed(req))) return controlRealmDenied(req);');
    expect(middleware).toContain("const ownerRoot = ownerControlledCabinetRole(p) !== null;");
    expect(middleware).toContain("return controlRealmResponse(req);");
    expect(middleware).toContain('if (!isControlRealmPathAllowed(p)) return controlRealmDenied(req);');
  });
});
