import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTROLLED_CABINET_CONTEXTS,
  CONTROLLED_TEST_ORGANIZATIONS,
  controlledCabinetContext,
  controlledOrganizationById,
} from '../../lib/platform-v7/controlled-test-organizations';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const ownerCenter = read('apps/web/components/platform-v7/staff/OwnerAccessCenterV3.tsx');
const openCabinet = read('apps/web/app/platform-v7/staff/open-cabinet/route.ts');
const staffFixture = read('apps/web/app/staff/[...path]/route.ts');
const verifiedSession = read('apps/web/lib/platform-v7/verified-session.ts');
const handoffPage = read('apps/web/app/platform-v7/staff/cabinet-handoff/page.tsx');
const canonicalSeed = read('apps/api/src/modules/deals/canonical-test-deal.seed.ts');
const persistentActors = read('apps/api/test/one-deal/persistent-auth-actors.ts');

const roles = [
  'operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor',
  'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive',
] as const;

describe('Platform V7 controlled test organization network', () => {
  it('creates a coherent test-company network for every cabinet', () => {
    expect(CONTROLLED_TEST_ORGANIZATIONS).toHaveLength(9);
    expect(new Set(CONTROLLED_TEST_ORGANIZATIONS.map((item) => item.id)).size).toBe(9);
    expect(CONTROLLED_TEST_ORGANIZATIONS.every((item) => item.testData === true)).toBe(true);
    expect(CONTROLLED_TEST_ORGANIZATIONS.every((item) => item.status === 'ACTIVE')).toBe(true);
    expect(CONTROLLED_TEST_ORGANIZATIONS.every((item) => item.kycStatus === 'VERIFIED')).toBe(true);
    expect(CONTROLLED_TEST_ORGANIZATIONS.every((item) => item.amlStatus === 'CLEAR')).toBe(true);

    for (const role of roles) {
      const context = CONTROLLED_CABINET_CONTEXTS[role];
      expect(context.role).toBe(role);
      expect(controlledOrganizationById(context.organizationId)?.name).toBe(context.organizationName);
      expect(context.memberEmail).toBe(`${role}.test@procent-agro.test`);
      expect(controlledCabinetContext(context.apiRole)?.role).toBe(role);
    }
  });

  it('shows and submits the assigned organization on the owner cabinet selector', () => {
    expect(ownerCenter).toContain('CONTROLLED_CABINET_CONTEXTS');
    expect(ownerCenter).toContain('Тестовый контур компаний');
    expect(ownerCenter).toContain('name="organizationId"');
    expect(ownerCenter).toContain('item.organization.organizationId');
    expect(ownerCenter).toContain('item.organization.organizationName');
    expect(ownerCenter).toContain("identity?.id === 'owner-controlled-test'");
  });

  it('binds the signed owner cabinet session to a server-approved organization', () => {
    expect(openCabinet).toContain('resolveControlledOrganization');
    expect(openCabinet).toContain("authority.source !== 'controlled'");
    expect(openCabinet).toContain('submittedOrganizationId !== context.organizationId');
    expect(openCabinet).toContain('organizationId: organization?.organizationId || null');
    expect(openCabinet).toContain('tenantId: organization?.tenantId || null');
    expect(openCabinet).toContain('ownerAccess: true');
    expect(verifiedSession).toContain('readVerifiedCabinetSessionContext');
    expect(verifiedSession).toContain('organizationId: typeof claims.org');
    expect(handoffPage).toContain('controlledOrganizationById(context.organizationId)');
  });

  it('exposes all test companies and role memberships through the controlled staff fixture', () => {
    expect(staffFixture).toContain("path === 'organizations'");
    expect(staffFixture).toContain('CONTROLLED_TEST_ORGANIZATIONS');
    expect(staffFixture).toContain('organizationMembers(organization.id)');
    expect(staffFixture).toContain('organization_name: item.organizationName');
    expect(staffFixture).toContain("id: 'deal-canonical-test'");
    expect(staffFixture).toContain('testData: true');
  });

  it('demotes stale default memberships before moving a seeded user to another organization', () => {
    expect(canonicalSeed).toContain('await tx.userOrg.updateMany({');
    expect(canonicalSeed).toContain('NOT: { organizationId: identity.orgId }');
    expect(canonicalSeed).toContain('data: { isDefault: false }');
    expect(canonicalSeed.indexOf('await tx.userOrg.updateMany({')).toBeLessThan(
      canonicalSeed.indexOf('const membership = await tx.userOrg.upsert({'),
    );
  });

  it('discovers all canonical actors through the tenant after organizations are split by role', () => {
    expect(persistentActors).toContain('primaryPrisma.organization.findMany');
    expect(persistentActors).toContain('const tenantIds = [...new Set(');
    expect(persistentActors).toContain('isDefault: true');
    expect(persistentActors).toContain("user: { id: { endsWith: '-e2e' } }");
    expect(persistentActors).toContain('organization: { tenantId: { in: tenantIds } }');
  });
});
