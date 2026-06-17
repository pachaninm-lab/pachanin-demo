import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const layout = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/layout.tsx'), 'utf8');
const client = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7LayoutClient.tsx'), 'utf8');

describe('platform-v7 public layout split', () => {
  it('does not mount AppShellV4 directly in the server layout', () => {
    expect(layout).toContain('PlatformV7LayoutClient');
    expect(layout).not.toContain('AppShellV4');
    expect(layout).not.toContain('PublicEntryCleanup');
  });

  it('renders public routes without the protected app shell', () => {
    expect(client).toContain("'/platform-v7'");
    expect(client).toContain("'/platform-v7/open'");
    expect(client).toContain("'/platform-v7/login'");
    expect(client).toContain("'/platform-v7/register'");
    expect(client).toContain('if (publicPath)');
    const publicBranch = client.slice(client.indexOf('if (publicPath)'), client.indexOf('return (', client.indexOf('if (publicPath)') + 1));
    expect(publicBranch).not.toContain('AppShellV4');
    expect(publicBranch).not.toContain('PlatformV7ShellUxController');
  });

  it('keeps protected routes inside AppShellV4 with guards and role shell controls', () => {
    expect(client).toContain('<AppShellV4 initialRole={initialRole}>');
    expect(client).toContain('<PlatformV7SingleEntryGuard />');
    expect(client).toContain('<PlatformV7ShellUxController />');
    expect(client).toContain('<RbacCabinetGuard />');
    expect(client).toContain('<CommandPalette />');
  });
});
