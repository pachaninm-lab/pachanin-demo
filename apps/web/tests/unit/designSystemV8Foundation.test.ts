import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('Design System v8 foundation', () => {
  it('keeps a four-layer DTCG-compatible token source', () => {
    const tokens = JSON.parse(read('packages/design-tokens/tokens.json'));
    expect(tokens.core).toBeTruthy();
    expect(tokens.semantic).toBeTruthy();
    expect(tokens.component).toBeTruthy();
    expect(tokens.context).toBeTruthy();
    expect(tokens.semantic.action.primary.$value).toBe('{core.color.green.700}');
  });

  it('loads the generated token output before legacy platform styles', () => {
    const runtime = read('apps/web/components/platform-v7/PlatformV7FullStyleRuntime.tsx');
    const tokenImport = runtime.indexOf("packages/design-tokens/tokens.css");
    const legacyImport = runtime.indexOf("@/app/v9.css");
    expect(tokenImport).toBeGreaterThanOrEqual(0);
    expect(tokenImport).toBeLessThan(legacyImport);
  });

  it('migrates NextActionCard without local styling', () => {
    const component = read('apps/web/components/platform-v7/NextActionCard.tsx');
    expect(component).toContain("@pc/design-system-v8");
    expect(component).not.toMatch(/style\s*=\s*\{\{/);
    expect(component).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('keeps v8 components free from literal colors and important overrides', () => {
    const css = read('packages/design-system-v8/src/components.module.css');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\brgba?\s*\(/i);
    expect(css).not.toContain('!important');
  });

  it('registers automatic governance', () => {
    const governance = JSON.parse(read('design-governance-v8.json'));
    expect(governance.migratedFiles).toContain('apps/web/components/platform-v7/NextActionCard.tsx');
    expect(read('package.json')).toContain('design:v8:guard');
    expect(read('.github/workflows/design-system-v8.yml')).toContain('check-design-system-v8.mjs');
  });
});
