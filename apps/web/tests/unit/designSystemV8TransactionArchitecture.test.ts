import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');

const fieldRolePages = [
  'apps/web/app/platform-v7/driver/field/page.tsx',
  'apps/web/app/platform-v7/elevator/page.tsx',
  'apps/web/app/platform-v7/lab/page.tsx',
  'apps/web/app/platform-v7/surveyor/page.tsx',
];

describe('Transaction UX v8 industrial architecture', () => {
  it('mounts one canonical transaction shell in the protected runtime', () => {
    const protectedShell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');
    expect(protectedShell).toContain("@/components/transaction-ux/TransactionAppShell");
    expect(protectedShell).toContain('<TransactionAppShell role={initialRole}>');
    expect(protectedShell).not.toContain('AppShellV4');
  });

  it('keeps role authority out of the canonical shell', () => {
    const shell = read('apps/web/components/transaction-ux/TransactionAppShell.tsx');
    expect(shell).toContain('PLATFORM_V7_ROLE_NAVIGATION');
    expect(shell).not.toContain('setRole(');
    expect(shell).not.toContain("localStorage.getItem('role')");
    expect(shell).not.toContain('inferRoleFromPath');
  });

  it('migrates all four field roles to reusable workbench templates', () => {
    for (const page of fieldRolePages) {
      const source = read(page);
      expect(source).toContain("@/components/transaction-ux/FieldTaskTemplate");
      expect(source).not.toContain('dangerouslySetInnerHTML');
      expect(source).not.toMatch(/\bstyle\s*=\s*\{\{/);
      expect(source).not.toContain('/platform-v7/bank');
      expect(source).not.toContain('/platform-v7/investor');
      expect(source).not.toContain('/platform-v7/control-tower');
    }
  });

  it('keeps field controls at 48px and transaction templates token-only', () => {
    const tokens = read('packages/design-tokens/tokens.css');
    const template = read('packages/design-system-v8/src/components.module.css');
    expect(tokens).toContain('--ds-control-height: 48px');
    expect(template).toContain('var(--ds-control-height)');
    expect(template).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(/);
  });

  it('exposes AI facts, inference, sources and limitations separately', () => {
    const designSystem = read('packages/design-system-v8/src/components.tsx');
    expect(designSystem).toContain('export function AiTransparency');
    expect(designSystem).toContain('<dt>Факты</dt>');
    expect(designSystem).toContain('<dt>Вывод</dt>');
    expect(designSystem).toContain('<dt>Источники</dt>');
    expect(designSystem).toContain('<dt>Ограничения</dt>');
  });
});
