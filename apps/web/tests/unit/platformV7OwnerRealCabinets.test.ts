import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const layout = source('app/platform-v7/layout.tsx');
const opener = source('app/platform-v7/staff/open-cabinet/route.ts');
const ownerCenter = source('components/platform-v7/staff/OwnerAccessCenterV3.tsx');
const ownerVerifier = source('lib/platform-v7/owner-controlled-cabinet-server.ts');
const controlledOrganizations = source('lib/platform-v7/controlled-test-organizations.ts');
const workspace = source('lib/first-customer-workspace-server.ts');

const roles = [
  'operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator',
  'lab', 'bank', 'organization', 'arbitrator', 'compliance', 'executive',
] as const;

describe('Platform owner real cabinet access', () => {
  it('offers all thirteen protected cabinet routes from the owner control center', () => {
    for (const role of roles) {
      expect(ownerCenter).toContain(`role: '${role}'`);
      expect(controlledOrganizations).toContain(`${role}: {`);
    }
    expect(opener).toContain("organization: '/platform-v7/profile'");
    expect(ownerCenter).toContain('All 13 working cabinets');
    expect(ownerCenter).toContain('все 13 рабочих кабинетов');
  });

  it('binds every real owner cabinet open to a fixed controlled test organization', () => {
    expect(opener).toContain('const context = controlledCabinetContext(role)');
    expect(opener).toContain("authority.source === 'controlled'");
    expect(opener).toContain('organizationId: organization.organizationId');
    expect(opener).toContain('tenantId: organization.tenantId');
    expect(opener).toContain('userId: authority.actorId');
    expect(opener).not.toContain("if (authority.source !== 'controlled') return null");
  });

  it('requires an active PLATFORM_OWNER assignment and MFA before minting owner cabinet access', () => {
    expect(opener).toContain('/staff/capabilities/me');
    expect(opener).toContain("item.role === 'PLATFORM_OWNER' && item.status === 'ACTIVE'");
    expect(opener).toContain('capabilities.authenticationAssurance.mfaVerified');
    expect(ownerVerifier).toContain('/staff/capabilities/me');
    expect(ownerVerifier).toContain("assignment.role === 'PLATFORM_OWNER' && assignment.status === 'ACTIVE'");
    expect(ownerVerifier).toContain('capabilities.authenticationAssurance.mfaVerified');
  });

  it('keeps ordinary business cabinet verification unchanged and adds only an owner-controlled branch', () => {
    expect(layout).toContain('getVerifiedOwnerControlledCabinet()');
    expect(layout).toContain('context.role !== role');
    expect(layout).toContain('context.userId !== profile.id');
    expect(layout).toContain('context.membershipId !== profile.membershipId');
    expect(layout).toContain('context.organizationId !== profile.orgId');
    expect(layout).toContain('context.tenantId !== profile.tenantId');
  });

  it('does not impersonate a business API identity for owner review', () => {
    expect(ownerVerifier).toContain('never changes the API access token');
    expect(ownerVerifier).toContain('never impersonates a business');
    expect(workspace).toContain('Do not query customer queues with the');
    expect(workspace).toContain('ownerControlled: true');
    expect(workspace).toContain('CONTROLLED_TEST');
    expect(workspace).not.toContain('PLATFORM_V7_ALLOW_DEMO_LOGIN');
    expect(opener).not.toContain('demo1234');
  });
});
