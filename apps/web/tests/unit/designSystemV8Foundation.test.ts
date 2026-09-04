import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const exists = (relativePath: string) => fs.existsSync(path.join(repoRoot, relativePath));

describe('Design System v8 foundation', () => {
  it('keeps a four-layer DTCG-compatible token source', () => {
    const tokens = JSON.parse(read('packages/design-tokens/tokens.json'));
    expect(tokens.core).toBeTruthy();
    expect(tokens.semantic).toBeTruthy();
    expect(tokens.component).toBeTruthy();
    expect(tokens.context).toBeTruthy();
    expect(tokens.semantic.action.primary.$value).toBe('{core.color.green.700}');
    expect(tokens.semantic.spacing.text.label.$value).toBe('{core.space.1}');
    expect(tokens.semantic.spacing.text.title.$value).toBe('{core.space.2}');
    expect(tokens.semantic.spacing.text.paragraph.$value).toBe('{core.space.3}');
    expect(tokens.semantic.spacing.text.action.$value).toBe('{core.space.4}');
    expect(tokens.semantic.spacing.layout.section.$value).toBe('{core.space.6}');
  });

  it('loads generated tokens through the governed v8 runtime without a legacy style bundle', () => {
    const runtime = read('apps/web/components/platform-v7/PlatformV7DesignSystemV8Runtime.tsx');
    expect(runtime).toContain('packages/design-tokens/tokens.css');
    expect(runtime).not.toContain('@/app/v9.css');
    expect(runtime).not.toContain('@/styles/');
    expect(exists('apps/web/components/platform-v7/PlatformV7FullStyleRuntime.tsx')).toBe(false);
  });

  it('migrates NextActionCard without local styling', () => {
    const component = read('apps/web/components/platform-v7/NextActionCard.tsx');
    expect(component).toContain('@pc/design-system-v8');
    expect(component).not.toMatch(/style\s*=\s*\{\{/);
    expect(component).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('keeps v8 components free from literal colors and important overrides', () => {
    const css = read('packages/design-system-v8/src/components.module.css');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\brgba?\s*\(/i);
    expect(css).not.toContain('!important');
    expect(css).toContain('var(--ds-text-gap-paragraph)');
    expect(css).toContain('var(--ds-layout-gap-section)');
  });

  it('uses governed text rhythm in shared cockpit layouts', () => {
    const hero = read('apps/web/components/platform-v7/premium/CockpitHero.tsx');
    const heroCss = read('apps/web/components/platform-v7/premium/CockpitHero.module.css');
    const roleCockpit = read('apps/web/components/platform-v7/RoleExecutionCockpit.tsx');
    const moneyCockpit = read('apps/web/components/transaction-ux/MoneyObligationCockpit.tsx');
    const moneyCss = read('apps/web/components/transaction-ux/MoneyObligationCockpit.module.css');
    const executionCss = read('apps/web/components/platform-v7/ExecutionDesignSystem.module.css');

    expect(hero).toContain('TextStack');
    expect(roleCockpit).toContain('TextStack');
    expect(moneyCockpit).toContain('TextStack');
    expect(hero).not.toMatch(/style\s*=\s*\{\{/);
    expect(roleCockpit).not.toMatch(/style\s*=\s*\{\{/);
    expect(heroCss).toContain('--ds-text-gap-title: var(--ds-space-2, 8px)');
    expect(moneyCss).toContain('var(--ds-text-gap-action)');
    expect(executionCss).toContain('var(--ds-text-gap-title, 8px)');
    expect(executionCss).toContain('var(--ds-text-gap-paragraph, 12px)');
  });

  it('registers automatic governance', () => {
    const governance = JSON.parse(read('design-governance-v8.json'));
    expect(governance.migratedFiles).toContain('apps/web/components/platform-v7/NextActionCard.tsx');
    expect(governance.migratedFiles).toContain('apps/web/components/platform-v7/RoleExecutionCockpit.tsx');
    expect(governance.migratedFiles).toContain('apps/web/components/platform-v7/premium/CockpitHero.tsx');
    expect(read('package.json')).toContain('design:v8:guard');
    expect(read('.github/workflows/design-system-v8.yml')).toContain('check-design-system-v8.mjs');
  });
});
