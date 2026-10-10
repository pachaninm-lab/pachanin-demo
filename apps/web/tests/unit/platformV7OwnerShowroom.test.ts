import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const ownerShowroom = source('app/platform-v7/staff/showroom/page.tsx');
const presentationShowroom = source('app/platform-v7/role-preview/showroom/page.tsx');

const roles = [
  'operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator',
  'lab', 'bank', 'employee', 'arbitrator', 'compliance', 'executive',
];

describe('Platform V7 showroom access', () => {
  it('keeps the privileged showroom behind real PLATFORM_OWNER authority with MFA', () => {
    expect(ownerShowroom).toContain("contract.roles.includes('PLATFORM_OWNER')");
    expect(ownerShowroom).toContain('contract.authenticationAssurance.mfaVerified !== true');
    expect(ownerShowroom).toContain('/staff/capabilities/me');
  });

  it('uses a finite high-entropy presentation bearer verified only by SHA-256', () => {
    expect(presentationShowroom).toContain("createHash('sha256')");
    expect(presentationShowroom).toContain('timingSafeEqual');
    expect(presentationShowroom).toContain("Date.parse('2026-08-21T17:50:00.000Z')");
    expect(presentationShowroom).not.toContain('SV2tI92WUgLHbTw9dloEfrMCQ-xLNOoz');
  });

  it('covers all thirteen presentation surfaces in both entry modes', () => {
    for (const role of roles) {
      expect(ownerShowroom).toContain(`['${role}',`);
      expect(presentationShowroom).toContain(`['${role}',`);
    }
  });

  it('never uses showroom access to fetch business data', () => {
    for (const showroom of [ownerShowroom, presentationShowroom]) {
      expect(showroom).not.toContain('/api/proxy/');
      expect(showroom).not.toContain('/deals/accessible');
      expect(showroom).not.toContain('/logistics/shipments');
      expect(showroom).not.toContain('/labs/samples');
      expect(showroom).not.toContain('getFirstCustomerWorkspace');
    }
  });

  it('disables mutating cockpit actions and marks both surfaces as showroom', () => {
    for (const showroom of [ownerShowroom, presentationShowroom]) {
      expect(showroom).toContain('disabled: true');
      expect(showroom).toContain('SHOWROOM · тестовые данные');
    }
    expect(ownerShowroom).toContain('Все кнопки, которые могли бы изменить состояние сделки, отключены');
    expect(presentationShowroom).toContain('Все потенциально изменяющие состояние действия отключены');
  });
});
