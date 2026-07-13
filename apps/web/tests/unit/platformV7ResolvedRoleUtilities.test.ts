import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const shell = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/PlatformV7ProtectedShell.tsx'), 'utf8');
const utilities = fs.readFileSync(path.join(process.cwd(), 'components/platform-v7/HeaderUtilityMenu.tsx'), 'utf8');

describe('resolved cabinet role in shell utilities', () => {
  it('passes the path-resolved role into navigation and utility controls', () => {
    expect(shell).toContain('<PlatformV7ShellUxController role={initialRole} />');
    expect(shell).toContain('<HeaderUtilityMenu role={initialRole} />');
    expect(utilities).toContain('export function HeaderUtilityMenu({ role }');
    expect(utilities).not.toContain("const role = usePlatformV7RStore((state) => state.role)");
  });
});
