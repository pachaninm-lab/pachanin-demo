import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('platform-v7 driver role shell guard', () => {
  it('keeps the header role switcher pointed to the driver field route', () => {
    const source = read('apps/web/components/platform-v7/RoleHeaderSwitcher.tsx');

    expect(source).toContain("driver: '/platform-v7/driver/field'");
    expect(source).toContain("if (shellPolicy === 'field')");
    expect(source).toContain("data-testid='platform-v7-header-role-label'");
    expect(source).toContain("data-testid='platform-v7-header-role-switcher'");
  });

  it('keeps driver paths in field shell without selectable header roles', () => {
    const source = read('apps/web/lib/platform-v7/shell-role-policy.ts');

    expect(source).toContain("if (pathname.startsWith('/platform-v7/driver')) return 'driver';");
    expect(source).toContain("export const FIELD_SHELL_ROLES = ['driver', 'surveyor', 'elevator', 'lab']");
    expect(source).toContain("export const FIELD_SHELL_PATHS = ['/platform-v7/driver'");
    expect(source).toContain("if (pathPolicy === 'field') return [];");
    expect(source).toContain("return pathPolicy !== 'field' && selectableRoles.length > 1;");
  });
});
