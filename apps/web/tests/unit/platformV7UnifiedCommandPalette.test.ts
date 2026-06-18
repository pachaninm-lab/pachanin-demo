import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const layout = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7LayoutClient.tsx'), 'utf8');
const shellPalette = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/v7r/CommandPalette.tsx'), 'utf8');

describe('platform-v7 unified command palette ownership', () => {
  it('does not mount a second platform-v7 command palette from the layout client', () => {
    expect(layout).not.toContain("import { CommandPalette } from '@/components/platform-v7/CommandPalette'");
    expect(layout).not.toContain('<CommandPalette />');
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
