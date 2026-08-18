import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const showroom = readFileSync(
  resolve(process.cwd(), 'app/platform-v7/staff/showroom/page.tsx'),
  'utf8',
);

describe('Platform V7 owner showroom', () => {
  it('requires real PLATFORM_OWNER authority with MFA', () => {
    expect(showroom).toContain("contract.roles.includes('PLATFORM_OWNER')");
    expect(showroom).toContain('contract.authenticationAssurance.mfaVerified !== true');
    expect(showroom).toContain('/staff/capabilities/me');
  });

  it('covers all thirteen presentation surfaces', () => {
    for (const role of [
      'operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator',
      'lab', 'bank', 'employee', 'arbitrator', 'compliance', 'executive',
    ]) {
      expect(showroom).toContain(`['${role}',`);
    }
  });

  it('never uses owner access to fetch business data', () => {
    expect(showroom).not.toContain('/api/proxy/');
    expect(showroom).not.toContain('/deals/accessible');
    expect(showroom).not.toContain('/logistics/shipments');
    expect(showroom).not.toContain('/labs/samples');
    expect(showroom).not.toContain('getFirstCustomerWorkspace');
  });

  it('disables mutating cockpit actions and marks the surface as showroom', () => {
    expect(showroom).toContain("disabled: true");
    expect(showroom).toContain('SHOWROOM · тестовые данные');
    expect(showroom).toContain('Все кнопки, которые могли бы изменить состояние сделки, отключены');
  });
});
