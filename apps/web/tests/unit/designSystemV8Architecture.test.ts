import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const fieldRolePages = [
  'apps/web/app/platform-v7/driver/field/page.tsx',
  'apps/web/app/platform-v7/elevator/page.tsx',
  'apps/web/app/platform-v7/lab/page.tsx',
  'apps/web/app/platform-v7/surveyor/page.tsx',
];

describe('Design System v8 industrial architecture', () => {
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

  it('migrates all four field roles to reusable v8 workbench templates', () => {
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

  it('keeps three density profiles and 48px field controls in token source', () => {
    const tokens = JSON.parse(read('packages/design-tokens/src/tokens.json'));
    expect(tokens.$schema).toBe('https://tr.designtokens.org/format/');
    expect(tokens.size.control.compact).toBeDefined();
    expect(tokens.size.control.comfortable).toBeDefined();
    expect(tokens.size.control.field.$value).toEqual({ value: 48, unit: 'px' });
  });

  it('exposes AI facts, inference, sources and limitations as separate UI fields', () => {
    const designSystem = read('packages/design-system-v8/src/index.tsx');
    expect(designSystem).toContain('export function AiTransparency');
    expect(designSystem).toContain('<dt>Факты</dt>');
    expect(designSystem).toContain('<dt>Вывод</dt>');
    expect(designSystem).toContain('<dt>Источники</dt>');
    expect(designSystem).toContain('<dt>Ограничения</dt>');
  });
});
