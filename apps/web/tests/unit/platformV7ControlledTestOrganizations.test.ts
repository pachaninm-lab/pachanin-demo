import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTROLLED_CABINET_CONTEXTS,
  CONTROLLED_TEST_ORGANIZATIONS,
  controlledCabinetContext,
  controlledOrganizationById,
} from '../../lib/platform-v7/controlled-test-organizations';

/**
 * Repo-root resolution, not cwd resolution.
 *
 * These paths are repo-root relative, but vitest runs with cwd at apps/web, so
 * resolve(process.cwd(), ...) pointed inside the web package. Every apps/web
 * path still opened, because apps/web/apps/web holds committed symlinks back to
 * apps/web - so the bug was invisible until a path reached apps/api, where no
 * such symlink exists, and then the whole file failed to load. Walking up to
 * the .git directory resolves from where the paths are actually written from,
 * and does not depend on those symlinks existing.
 */
function repoRoot(): string {
  let dir = __dirname;
  while (!existsSync(join(dir, '.git')) && dirname(dir) !== dir) dir = dirname(dir);
  return dir;
}

const read = (path: string) => readFileSync(resolve(repoRoot(), path), 'utf8');

/** Comments become whitespace, so prose about retired code is not read as code. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/gu, '$1 ');
}
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
    // The heading this pinned was replaced by copy that states the property
    // instead of naming the feature: each cabinet opens in its bound controlled
    // organization, the owner account and its MFA stay real, and the client role
    // is not substituted in the API. Asserting that sentence keeps the panel
    // from quietly going back to describing a role swap.
    expect(ownerCenter).toContain('контролируемой тестовой организации');
    expect(ownerCenter).toContain('роль клиента не подменяется в API');
    expect(ownerCenter).toContain('name="organizationId"');
    expect(ownerCenter).toContain('item.organization.organizationId');
    expect(ownerCenter).toContain('item.organization.organizationName');
    // The panel used to branch on a fixture identity id. That branch is gone,
    // and its absence is the stronger property: the owner cabinet selector has
    // no fixture-only path through it, so what an owner sees is not decided by
    // whether they are the controlled test owner.
    expect(ownerCenter).not.toContain('owner-controlled-test');
  });

  it('binds the signed owner cabinet session to a server-approved organization', () => {
    expect(openCabinet).toContain('resolveControlledOrganization');
    // Same rule, written the other way round since this test was pinned: the
    // controlled fixture must submit the organization the server expects. The
    // positive form is what the route carries now.
    expect(openCabinet).toContain("authority.source === 'controlled'");
    expect(openCabinet).toContain('submittedOrganizationId !== context.organizationId');
    // Tightened since this was pinned: the organization is resolved before the
    // session is signed and can no longer be null, so the optional form these
    // asserted would now be a loosening rather than a match.
    expect(openCabinet).toContain('organizationId: organization.organizationId');
    expect(openCabinet).toContain('tenantId: organization.tenantId');
    expect(openCabinet).not.toContain('organizationId: organization?.organizationId || null');
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

  /**
   * This asserted the harness rediscovered its actors by querying organizations
   * and tenants directly. That mechanism was retired, and what replaced it is
   * stronger rather than weaker: the harness enters through AuthService.login
   * exactly as a real client does - credential lookup, password proof, then the
   * bounded membership lookup - and reads role, tenant and organization only
   * from the resulting server-side session projection.
   *
   * Demanding the old query back would be demanding a regression, so the
   * contract is asserted instead: real login in, server projection out, and the
   * retired resolver functions stay retired.
   */
  it('resolves every canonical actor through the real login path, not by querying identities', () => {
    expect(persistentActors).toContain('primaryAuth.login({');
    expect(persistentActors).toContain('PERSISTENT_ACTOR_USER_IDS');
    // Comments are stripped first. The file explains in prose which resolvers
    // were retired, and a scanner that counted that explanation as a live call
    // would report the opposite of the truth - the better the comment, the
    // louder the false positive.
    const actorCode = stripComments(persistentActors);
    expect(actorCode).not.toContain('resolve_login_identity');
    expect(actorCode).not.toContain('resolve_login_memberships');
    // The connection principal is still pinned, so the harness cannot silently
    // gain a wider database identity than the one it is meant to prove against.
    expect(persistentActors).toContain("currentUser !== 'one_deal_auth'");
  });
});
