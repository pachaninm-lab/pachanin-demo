import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const join = (...parts: string[]) => parts.join('');
const gatePath = path.join(repoRoot, 'scripts/check-design-system-v8-zero-reference.mjs');

const forbiddenFiles = [
  `apps/web/components/platform-v7/${join('PlatformV7', 'FullStyleRuntime')}.tsx`,
  `apps/web/components/platform-v7/${join('PlatformV7', 'ProtectedTemplateRuntime')}.tsx`,
  `apps/web/components/platform-v7/${join('PlatformV7', 'TemplateGuards')}.tsx`,
  `apps/web/components/platform-v7/${join('PlatformV7', 'TemplateSwitch')}.tsx`,
  `apps/web/components/v7r/${join('Shell', 'CopyNormalizer')}.tsx`,
  `apps/web/components/platform-v7/${join('PlatformV7', 'ViewportRuntimeGuard')}.tsx`,
  `apps/web/components/platform-v7/${join('PlatformV7', 'UniversalAdaptiveStyle')}.tsx`,
  `apps/web/components/platform-v7/${join('PlatformV7', 'BlankScreenGuard')}.tsx`,
  `apps/web/components/platform-v7/${join('Viewport', 'StabilityGuard')}.tsx`,
];

describe('platform-v7 legacy runtime zero-reference gate', () => {
  it('removes forbidden runtime artifacts from the repository', () => {
    for (const relativePath of forbiddenFiles) {
      expect(fs.existsSync(path.join(repoRoot, relativePath)), relativePath).toBe(false);
    }
  });

  it('keeps the critical shell free from DOM patch primitives', () => {
    const shellSources = [
      'apps/web/app/platform-v7/layout.tsx',
      'apps/web/app/platform-v7/template.tsx',
      'apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx',
      'apps/web/components/platform-v7/PlatformV7LayoutClient.tsx',
      'apps/web/components/platform-v7/PlatformV7DesignSystemV8Runtime.tsx',
    ].map((relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')).join('\n');

    for (const primitive of ['MutationObserver', 'ResizeObserver', 'visualViewport', 'requestAnimationFrame', 'createTreeWalker', 'getComputedStyle', 'style.setProperty']) {
      expect(shellSources, primitive).not.toContain(primitive);
    }
  });

  it('executes the machine-checkable repository gate', () => {
    const output = execFileSync(process.execPath, [gatePath], { cwd: repoRoot, encoding: 'utf8' });
    expect(output).toContain('[platform-v7-legacy-runtime-zero] PASS');
    expect(output).toContain('production references are zero');
  });
});
