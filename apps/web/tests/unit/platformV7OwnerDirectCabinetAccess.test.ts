import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const wrapper = read('apps/web/components/platform-v7/staff/OwnerAccessCenter.tsx');
const center = read('apps/web/components/platform-v7/staff/OwnerAccessCenterV3.tsx');
const route = read('apps/web/app/api/staff/owner-cabinet/open/route.ts');
const css = read('apps/web/components/platform-v7/staff/OwnerAccessCenterV3.module.css');

describe('platform-v7 owner direct cabinet access', () => {
  it('shows the platform owner all twelve actual cabinet surfaces without the request form', () => {
    expect(wrapper).toContain("./OwnerAccessCenterV3");
    expect(center).toContain("role: 'operator'");
    expect(center).toContain("role: 'buyer'");
    expect(center).toContain("role: 'seller'");
    expect(center).toContain("role: 'logistics'");
    expect(center).toContain("role: 'driver'");
    expect(center).toContain("role: 'surveyor'");
    expect(center).toContain("role: 'elevator'");
    expect(center).toContain("role: 'lab'");
    expect(center).toContain("role: 'bank'");
    expect(center).toContain("role: 'arbitrator'");
    expect(center).toContain("role: 'compliance'");
    expect(center).toContain("role: 'executive'");
    expect(center).not.toContain('Рабочий тикет');
    expect(center).not.toContain('Причина доступа');
  });

  it('requires a verified controlled owner token and never overwrites the owner access token', () => {
    expect(route).toContain("claims.owner !== true");
    expect(route).toContain("claims.testAccess !== true");
    expect(route).toContain("claims.tokenType !== 'access'");
    expect(route).toContain('assertCsrf(request)');
    expect(route).toContain('signCabinetSession(role, signingSecret');
    expect(route).not.toContain('response.cookies.set(ACCESS_COOKIE');
  });

  it('switches only the server-verified cabinet and role marker before navigation', () => {
    expect(route).toContain('response.cookies.set(CABINET_SESSION_COOKIE');
    expect(route).toContain('response.cookies.set(SESSION_COOKIE');
    expect(route).toContain("response.cookies.set('pc-role'");
    expect(center).toContain("window.sessionStorage.setItem('pc-v7-active-role', payload.role)");
    expect(center).toContain('window.location.assign(payload.redirectTo)');
  });

  it('retains privileged staff management as a separate advanced surface', () => {
    expect(center).toContain('<OwnerAccessCenterV2 {...props} />');
    expect(center).toContain('setAdvanced(true)');
    expect(center).toContain('setAdvanced(false)');
  });

  it('is mobile first and keeps safe-area padding and large touch targets', () => {
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('@media (max-width: 520px)');
    expect(css).toContain('grid-template-columns: 1fr');
    expect(css).toContain('min-height: 54px');
  });
});
