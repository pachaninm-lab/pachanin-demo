import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const file = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/CommandPalette.tsx'), 'utf8');
const shellRoutes = fs.readFileSync(path.join(process.cwd(), 'lib/platform-v7/shellRoutes.ts'), 'utf8');

describe('platform-v7 command palette role boundaries', () => {
  it('sources commands from the canonical role navigation registry', () => {
    expect(file).toContain('platformV7CommandNavByRole');
    expect(file).toContain('platformV7RoleCanOpenHref');
    expect(file).not.toContain('ROLE_COMMANDS');
    expect(file).not.toContain('const base: Command[]');
    expect(file).toContain('placeholder="Найти экран своей роли…"');
  });

  it('checks route safety before rendering and opening command hrefs', () => {
    expect(file).toContain('.filter((item) => platformV7RoleCanOpenHref(role, item.href))');
    expect(file).toContain('if (cmd.href && platformV7RoleCanOpenHref(role, cmd.href)) router.push(cmd.href);');
  });

  it('keeps command navigation derived from bottom and drawer role links', () => {
    expect(shellRoutes).toContain('entry.command = [...entry.bottom, ...entry.drawer]');
    expect(shellRoutes).toContain('platformV7CommandNavByRole');
  });

  it('keeps role migration route blocked by the shared route safety helper', () => {
    expect(shellRoutes).toContain('ROLE_BLOCKED_PREFIXES');
    expect(shellRoutes).toContain('PLATFORM_V7_ROLES_ROUTE');
  });
});
