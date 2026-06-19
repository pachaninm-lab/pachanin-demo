import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const layoutClient = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/PlatformV7LayoutClient.tsx'), 'utf8');
const appLayout = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/layout.tsx'), 'utf8');
const shellPalette = fs.readFileSync(path.join(process.cwd(), 'components/v7r/CommandPalette.tsx'), 'utf8');

describe('platform-v7 unified command palette ownership', () => {
  it('does not mount a second platform-v7 command palette from layout wrappers', () => {
    expect(layoutClient).not.toContain("import { CommandPalette } from '@/components/platform-v7/CommandPalette'");
    expect(layoutClient).not.toContain('<CommandPalette />');
    expect(appLayout).not.toContain("import { CommandPalette } from '@/components/platform-v7/CommandPalette'");
    expect(appLayout).not.toContain('<CommandPalette />');
  });

  it('keeps the app shell command palette role-safe', () => {
    expect(shellPalette).toContain('platformV7CommandNavByRole');
    expect(shellPalette).toContain('platformV7RoleCanOpenHref');
    expect(shellPalette).toContain('usePlatformV7RStore');
  });

  it('filters search results and recent items through the active role', () => {
    expect(shellPalette).toContain('.filter((item) => roleSafe(role, item))');
    expect(shellPalette).toContain('if (!roleSafe(role, item)) return;');
    expect(shellPalette).toContain('if (roleSafe(role, item))');
  });
});
