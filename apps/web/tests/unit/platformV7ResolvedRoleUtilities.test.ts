import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const shell = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/PlatformV7ProtectedShell.tsx'), 'utf8');
const utilities = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/HeaderUtilityMenu.tsx'), 'utf8');

describe('resolved cabinet role and shared utilities', () => {
  it('binds role navigation to the cabinet while keeping shared help role-neutral', () => {
    expect(shell).toContain('<PlatformV7ShellUxController role={initialRole} />');
    expect(shell).toContain('<HeaderUtilityMenu />');
    expect(utilities).toContain('export function HeaderUtilityMenu()');
    expect(utilities).toContain('Помощь по работе');
    expect(utilities).not.toContain('?role=');
  });
});
