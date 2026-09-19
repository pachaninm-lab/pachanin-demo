import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const file = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/ai/page.tsx'), 'utf8');

function block(name: string, next: string) {
  return file.slice(file.indexOf(`${name}: {`), file.indexOf(`${next}: {`));
}

describe('platform-v7 AI role scope', () => {
  it('uses active role lock instead of role query param', () => {
    expect(file).toContain('readActiveRole');
    expect(file).toContain('window.sessionStorage.getItem(ACTIVE_ROLE_KEY)');
    expect(file).not.toContain("searchParams.get('role')");
  });

  it('filters every AI action by allowed role prefixes', () => {
    expect(file).toContain('ALLOWED_PREFIXES');
    expect(file).toContain('allowedForRole');
    expect(file).toContain('filterActions');
    expect(file).toContain('return filterActions(role, config.actions)');
  });

  it('keeps driver AI inside driver cabinet only', () => {
    const driver = block('driver', 'surveyor');
    expect(driver).toContain('/platform-v7/driver');
    expect(driver).not.toContain('/platform-v7/logistics');
    expect(driver).not.toContain('/platform-v7/elevator');
    expect(driver).not.toContain('/platform-v7/deals');
    expect(driver).not.toContain('/platform-v7/bank');
  });

  it('keeps elevator and lab AI inside their own cabinets', () => {
    const elevator = block('elevator', 'lab');
    const lab = block('lab', 'bank');
    expect(elevator).toContain('/platform-v7/elevator');
    expect(elevator).not.toContain('/platform-v7/lab');
    expect(elevator).not.toContain('/platform-v7/deals');
    expect(lab).toContain('/platform-v7/lab');
    expect(lab).not.toContain('/platform-v7/disputes');
    expect(lab).not.toContain('/platform-v7/deals');
  });

  it('keeps bank AI inside bank cabinet tree', () => {
    const bank = block('bank', 'arbitrator');
    expect(bank).toContain('/platform-v7/bank');
    expect(bank).toContain('/platform-v7/bank/factoring');
    expect(bank).toContain('/platform-v7/bank/escrow');
    expect(bank).not.toContain('/platform-v7/deals');
    expect(bank).not.toContain('/platform-v7/disputes');
  });

  it('keeps AI route allowed for every role without widening other routes', () => {
    expect(file).toContain("driver: ['/platform-v7/driver', '/platform-v7/ai']");
    expect(file).toContain("elevator: ['/platform-v7/elevator', '/platform-v7/ai']");
    expect(file).toContain("lab: ['/platform-v7/lab', '/platform-v7/ai']");
  });
});
