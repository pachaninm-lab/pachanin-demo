import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const protectedShell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');
const appShell = read('apps/web/components/v7r/AppShellV4.tsx');
const appShellCss = read('apps/web/components/v7r/AppShellV4.module.css');
const workspace = read('apps/web/components/transaction-ux/TransactionDealWorkspace.tsx');
const workspaceCss = read('apps/web/components/transaction-ux/TransactionDealWorkspace.module.css');
const canonicalContract = read('apps/web/components/transaction-ux/CanonicalDealWorkspace.tsx');
const tsconfig = read('apps/web/tsconfig.json');

const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('Transaction UX v8 shell and Deal Workspace migration', () => {
  it('keeps exactly one active protected App Shell', () => {
    expect(protectedShell).toContain("from '@/components/v7r/AppShellV4'");
    expect(protectedShell).toContain('<AppShellV4 initialRole={initialRole}>');
    expect(protectedShell).not.toContain('TransactionAppShell');
    expect(appShell).toContain("import styles from './AppShellV4.module.css'");
    expect(appShell).not.toMatch(/dangerouslySetInnerHTML|style\s*=\s*\{\{/);
    expect(appShellCss).not.toMatch(forbiddenPresentation);
  });

  it('routes the canonical Deal Workspace contract to the governed v8 implementation', () => {
    expect(tsconfig).toContain('"@/components/platform-v7/CanonicalDealWorkspace"');
    expect(tsconfig).toContain('"./components/transaction-ux/CanonicalDealWorkspace.tsx"');
    expect(canonicalContract).toContain('TransactionDealWorkspace as CanonicalDealWorkspace');
    expect(workspace).toContain("from '@pc/design-system-v8'");
    expect(workspace).toContain('NextActionCard');
    expect(workspace).toContain('InlineNotice');
    expect(workspace).toContain('StatusChip');
    expect(workspace).toContain("data-transaction-workspace='v8'");
  });

  it('preserves server authority, idempotency and optimistic concurrency', () => {
    expect(workspace).toContain('/execution-workspace');
    expect(workspace).toContain('/commands/');
    expect(workspace).toContain('idempotencyKey');
    expect(workspace).toContain('expectedUpdatedAt: workspace.deal.updatedAt');
    expect(workspace).toContain('expectedVersion: workspace.deal.version');
    expect(workspace).toContain('reason instanceof HttpError && reason.status === 409');
    expect(workspace).toContain('Данные изменились другим участником');
  });

  it('keeps bank confirmation system-controlled and offline behavior honest', () => {
    expect(workspace).toContain("action?.source === 'BANK_CALLBACK'");
    expect(workspace).toContain("action?.waitingForRoles.includes('BANK_CALLBACK')");
    expect(workspace).toContain('Ручное подтверждение невозможно.');
    expect(workspace).toContain('Действие не отправлено и не сохранено на устройстве');
  });

  it('keeps the migrated workspace token-only and accessible across display modes', () => {
    expect(workspace).not.toMatch(forbiddenPresentation);
    expect(workspaceCss).not.toMatch(forbiddenPresentation);
    expect(workspaceCss).toContain('var(--ds-control-height)');
    expect(workspaceCss).toContain(':focus-visible');
    expect(workspaceCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(workspaceCss).toContain('@media (forced-colors: active)');
    expect(workspaceCss).toContain('@media (max-width: 430px)');
  });
});
