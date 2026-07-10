import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('platform-v7 canonical one-deal workspace', () => {
  const workspace = source('components/platform-v7/CanonicalDealWorkspace.tsx');
  const dashboard = source('components/platform-v7/RoleIntentDashboard.tsx');
  const shell = source('components/platform-v7/PlatformV7ProtectedShell.tsx');
  const proxy = source('app/api/proxy/[...path]/route.ts');
  const login = source('app/platform-v7/login/page.tsx');

  it('uses one canonical deal identifier and the authenticated execution workspace', () => {
    expect(workspace).toContain("const DEAL_ID = 'DEAL-INDUSTRIAL-001'");
    expect(workspace).toContain('/execution-workspace');
    expect(workspace).toContain('/commands/${action.id}');
    expect(workspace).toContain('expectedUpdatedAt: workspace.deal.updatedAt');
    expect(workspace).toContain('idempotencyKey');
  });

  it('renders the same workspace at every role root instead of the old dashboard below it', () => {
    expect(dashboard).toContain('<CanonicalDealWorkspace role={role} />');
    expect(dashboard).not.toContain('getRoleIntentConfig');
    expect(shell).toContain("'/platform-v7/surveyor'");
    expect(shell).toContain('? <RoleIntentDashboard role={initialRole} />');
    expect(shell).toContain(': children;');
    expect(shell).not.toContain('{showRoleIntentDashboard ? <RoleIntentDashboard role={initialRole} /> : null}');
  });

  it('never fabricates a successful canonical response when the real API is unavailable', () => {
    expect(proxy).toContain("const CANONICAL_DEAL_ID = 'DEAL-INDUSTRIAL-001'");
    expect(proxy).toContain('requiresRealBackend');
    expect(proxy).toContain("code: 'REAL_BACKEND_REQUIRED'");
    expect(proxy).toContain("if (strictRealPath) return realBackendUnavailable('real_backend_not_used')");
  });

  it('never exposes a user button or synthetic reference for bank confirmations', () => {
    expect(workspace).toContain("action?.source === 'BANK_CALLBACK'");
    expect(workspace).toContain('Ручное подтверждение невозможно');
    expect(workspace).not.toContain('TEST-RESERVE-');
    expect(workspace).not.toContain('TEST-RELEASE-');
    expect(workspace).not.toContain("if (actionId === 'confirm_reserve')");
    expect(workspace).not.toContain("if (actionId === 'confirm_release')");
  });

  it('uses verified single entry and does not let the user choose a role before authentication', () => {
    expect(login).toContain("fetch('/api/auth/login'");
    expect(login).toContain("fetch('/api/platform-v7/cabinet-session'");
    expect(login).toContain("const sessionBody = payload?.demo === true ? { role } : {}");
    expect(login).toContain('body: JSON.stringify(sessionBody)');
    expect(login).not.toContain('const workspaces');
    expect(login).not.toContain('setDirectRole');
  });
});
