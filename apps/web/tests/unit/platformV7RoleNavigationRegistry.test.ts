import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const shellRoutes = fs.readFileSync(path.join(process.cwd(), 'lib/platform-v7/shellRoutes.ts'), 'utf8');
const assistantWidget = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/RoleAssistantWidget.tsx'), 'utf8');

const roles = ['operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive'];

describe('platform-v7 canonical role navigation registry', () => {
  it('defines one registry entry for every role', () => {
    expect(shellRoutes).toContain('PLATFORM_V7_ROLE_NAVIGATION');
    for (const role of roles) {
      expect(shellRoutes).toContain(`${role}: {`);
    }
  });

  it('keeps role bottom navigation to a maximum of five direct destinations', () => {
    const bottomBlocks = shellRoutes.match(/bottom: \[[\s\S]*?\],\n    drawer:/g) ?? [];
    expect(bottomBlocks.length).toBe(roles.length);
    for (const block of bottomBlocks) {
      const entries = block.match(/href:/g) ?? [];
      expect(entries.length).toBeLessThanOrEqual(5);
    }
  });

  it('keeps AI, logout and role switch out of role bottom navigation', () => {
    const bottomBlocks = shellRoutes.match(/bottom: \[[\s\S]*?\],\n    drawer:/g) ?? [];
    for (const block of bottomBlocks) {
      expect(block).not.toContain('PLATFORM_V7_AI_ROUTE');
      expect(block).not.toContain('/platform-v7/ai');
      expect(block).not.toContain('LogOut');
      expect(block).not.toContain('/platform-v7/roles');
    }
  });

  it('exposes role-safe route helper and blocks role migration route', () => {
    expect(shellRoutes).toContain('platformV7RoleCanOpenHref');
    expect(shellRoutes).toContain('ROLE_BLOCKED_PREFIXES');
    expect(shellRoutes).toContain('PLATFORM_V7_ROLES_ROUTE');
  });

  it('removes utility menu actions from the role dock surface', () => {
    expect(assistantWidget).toContain(".pc-v7-role-dock a[href='/platform-v7/ai']");
    expect(assistantWidget).toContain('.pc-v7-role-dock button.pc-v7-role-dock-item');
  });
});
