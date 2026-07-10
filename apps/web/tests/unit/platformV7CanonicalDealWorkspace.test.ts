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
  const loginPage = source('app/platform-v7/login/page.tsx');
  const loginClient = source('app/platform-v7/login/LoginFormClient.tsx');
  const loginRoute = source('app/api/auth/login/route.ts');

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

  it('uses verified single entry and does not let the browser choose a role', () => {
    expect(loginPage).not.toContain("'use client'");
    expect(loginPage).toContain('<LoginFormClient copy={copy} />');
    expect(loginClient).toContain("requestJson('/api/auth/login'");
    expect(loginClient).not.toContain('/api/platform-v7/cabinet-session');
    expect(loginClient).not.toContain('usePlatformV7RStore');
    expect(loginClient).not.toContain('sessionStorage');
    expect(loginRoute).toContain('normalizeSurfaceRole(payload.user.role, payload.user.surfaceRole)');
    expect(loginRoute).not.toContain('detectDemoRole');
    expect(loginClient).not.toContain('const workspaces');
    expect(loginClient).not.toContain('setDirectRole');
  });
});
