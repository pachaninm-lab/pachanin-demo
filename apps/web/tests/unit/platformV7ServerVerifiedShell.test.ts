import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const root = [cwd, path.resolve(cwd, '../..')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'design-governance-v8.json')));

if (!root) throw new Error(`Cannot resolve repository root from ${cwd}`);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const layout = read('apps/web/app/platform-v7/layout.tsx');
const runtime = read('apps/web/components/platform-v7/PlatformV7ProtectedRuntime.tsx');
const shell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');

 describe('platform-v7 server-verified shell role', () => {
  it('verifies a signed cabinet or access JWT before protected rendering', () => {
    expect(layout).toContain('readVerifiedCabinetSessionRole');
    expect(layout).toContain('readVerifiedCabinetRole');
    expect(layout).toContain("cookieStore.get(CABINET_SESSION_COOKIE)");
    expect(layout).toContain('cookieStore.get(ACCESS_COOKIE)');
    expect(layout).toContain('if (!role) redirect(loginHref(pathname))');
  });

  it('rejects a foreign cabinet before client role UI is loaded', () => {
    expect(layout).toContain('canRoleAccessCabinet(role, pathname)');
    expect(layout).toContain('redirect(platformV7RoleRoute(role))');
    expect(layout).not.toContain('resolvePlatformV7PathRole');
    expect(layout).not.toContain("searchParams.get('as')");
    expect(layout).not.toContain("cookies().get('pc-role')");
  });

  it('passes one verified role through runtime and protected shell', () => {
    expect(layout).toContain('verifiedRole={role}');
    expect(runtime).toContain('verifiedRole: PlatformRole');
    expect(runtime).toContain('<PlatformV7ProtectedShell pathname={pathname} verifiedRole={verifiedRole}>');
    expect(shell).toContain('verifiedRole: PlatformRole');
    expect(shell).toContain('<AppShellV4 initialRole={verifiedRole}>');
    expect(shell).toContain('<PlatformV7ShellUxController role={verifiedRole} />');
    expect(shell).toContain('<RoleIntentDashboard role={verifiedRole} />');
  });

  it('synchronizes the presentation store before paint without deriving role from URL', () => {
    expect(shell).toContain('React.useLayoutEffect');
    expect(shell).toContain('setRole(verifiedRole)');
    expect(shell).toContain('usePlatformV7RStore.persist.rehydrate()');
    expect(shell).not.toContain('function roleFromPath');
    expect(shell).not.toContain('startsWith(\'/platform-v7/driver\')');
  });
});
