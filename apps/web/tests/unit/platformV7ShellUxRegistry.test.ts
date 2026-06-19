import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const file = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/PlatformV7ShellUxController.tsx'), 'utf8');

describe('platform-v7 shell UX controller registry sourcing', () => {
  it('sources role home, dock and drawer links from the canonical role navigation registry', () => {
    expect(file).toContain('platformV7RoleRoute');
    expect(file).toContain('platformV7NavByRole');
    expect(file).toContain('platformV7DrawerNavByRole');
    expect(file).toContain('platformV7RoleCanOpenHref');
    expect(file).not.toContain('SAFE_NAV_BY_ROLE');
    expect(file).not.toContain('DOCK_BY_ROLE');
  });

  it('keeps AI and menu out of the role dock implementation', () => {
    expect(file).not.toContain("href: '/platform-v7/ai'");
    expect(file).not.toContain("label: 'ИИ'");
    expect(file).not.toContain('<Menu');
  });

  it('keeps driver home aligned to the field route through the registry', () => {
    expect(file).not.toContain("driver: '/platform-v7/driver'");
    expect(file).toContain('platformV7RoleRoute(activeRole)');
    expect(file).toContain("href: '/platform-v7/driver/field'");
  });

  it('filters drawer and notification links through the role route safety helper', () => {
    expect(file).toContain('safeRoleNav(activeRole');
    expect(file).toContain('platformV7RoleCanOpenHref(activeRole, item.href)');
  });
});
