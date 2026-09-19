import { describe, expect, it } from 'vitest';
import {
  platformV7BuildActor,
  platformV7CanAccessOwnObject,
  platformV7IsCrossTenant,
  platformV7ResolveObjectOrganizations,
  type PlatformV7User,
} from '@/lib/platform-v7/tenant-model';
import type { PlatformV7ResourceScope } from '@/lib/platform-v7/access-control';

const sellerA: PlatformV7User = { id: 'u-seller-a', organizationId: 'org-A', roles: ['seller'] };
const sellerB: PlatformV7User = { id: 'u-seller-b', organizationId: 'org-B', roles: ['seller'] };
const buyerA: PlatformV7User = { id: 'u-buyer-a', organizationId: 'org-buyer-A', roles: ['buyer'] };
const bankA: PlatformV7User = { id: 'u-bank-a', organizationId: 'org-bank-A', roles: ['bankOfficer'] };
const operator: PlatformV7User = { id: 'u-op', organizationId: 'org-platform', roles: ['operator'] };

const dealOfOrgA: PlatformV7ResourceScope = {
  resourceType: 'deal',
  resourceId: 'DL-1',
  sellerOrganizationId: 'org-A',
  buyerOrganizationId: 'org-buyer-A',
  bankOrganizationId: 'org-bank-A',
};

describe('PR-1 tenant isolation (доступ только к своим объектам)', () => {
  it('resolves all participating organizations of a deal object', () => {
    expect([...platformV7ResolveObjectOrganizations(dealOfOrgA)].sort()).toEqual(
      ['org-A', 'org-buyer-A', 'org-bank-A'].sort(),
    );
  });

  it('lets the owning seller read its own deal', () => {
    const actor = platformV7BuildActor(sellerA, 'seller');
    expect(platformV7CanAccessOwnObject(actor, dealOfOrgA, 'read')).toBe(true);
    expect(platformV7IsCrossTenant(actor, dealOfOrgA)).toBe(false);
  });

  it('denies a foreign-org seller access to another org deal (cross-tenant)', () => {
    const actor = platformV7BuildActor(sellerB, 'seller');
    expect(platformV7CanAccessOwnObject(actor, dealOfOrgA, 'read')).toBe(false);
    expect(platformV7IsCrossTenant(actor, dealOfOrgA)).toBe(true);
  });

  it('isolates money objects to the owning organizations only', () => {
    const moneyOfOrgA: PlatformV7ResourceScope = {
      resourceType: 'money',
      resourceId: 'M-1',
      sellerOrganizationId: 'org-A',
      buyerOrganizationId: 'org-buyer-A',
      bankOrganizationId: 'org-bank-A',
    };
    expect(platformV7CanAccessOwnObject(platformV7BuildActor(buyerA, 'buyer'), moneyOfOrgA, 'read')).toBe(true);
    // продавец другой организации не видит деньги чужой сделки
    expect(platformV7CanAccessOwnObject(platformV7BuildActor(sellerB, 'seller'), moneyOfOrgA, 'read')).toBe(false);
    // банк своей организации видит, чужой — нет
    expect(platformV7CanAccessOwnObject(platformV7BuildActor(bankA, 'bankOfficer'), moneyOfOrgA, 'read')).toBe(true);
    const bankOther = platformV7BuildActor({ id: 'u-bank-x', organizationId: 'org-bank-X', roles: ['bankOfficer'] }, 'bankOfficer');
    expect(platformV7CanAccessOwnObject(bankOther, moneyOfOrgA, 'read')).toBe(false);
  });

  it('isolates a driver trip to the assigned driver user', () => {
    const trip: PlatformV7ResourceScope = { resourceType: 'trip', resourceId: 'T-1', assignedDriverUserId: 'driver-1' };
    const assigned = platformV7BuildActor({ id: 'driver-1', organizationId: 'carrier-1', roles: ['driver'] }, 'driver');
    const other = platformV7BuildActor({ id: 'driver-2', organizationId: 'carrier-1', roles: ['driver'] }, 'driver');
    expect(platformV7CanAccessOwnObject(assigned, trip, 'read')).toBe(true);
    expect(platformV7CanAccessOwnObject(other, trip, 'read')).toBe(false);
    expect(platformV7IsCrossTenant(other, trip)).toBe(true);
  });

  it('treats oversight roles (operator) as platform-scoped, not cross-tenant', () => {
    const actor = platformV7BuildActor(operator, 'operator');
    expect(platformV7IsCrossTenant(actor, dealOfOrgA)).toBe(false);
    expect(platformV7CanAccessOwnObject(actor, dealOfOrgA, 'read')).toBe(true);
  });
});
