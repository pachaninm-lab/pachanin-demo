import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const absolute = (relativePath: string) => path.join(root, relativePath);
const read = (relativePath: string) => fs.readFileSync(absolute(relativePath), 'utf8');

const removed = [
  'apps/web/components/platform-v7/LoginHeaderLogoGuard.tsx',
  'apps/web/components/platform-v7/LoginMobileStabilityStyle.tsx',
  'apps/web/components/platform-v7/MobileLogoutSoftExit.tsx',
  'apps/web/components/platform-v7/PlatformV7BlankScreenGuard.tsx',
  'apps/web/components/platform-v7/PlatformV7InteractionFixes.tsx',
  'apps/web/components/platform-v7/PlatformV7MobileFinalGuard.tsx',
  'apps/web/components/platform-v7/PlatformV7RoleLockFix.tsx',
  'apps/web/components/platform-v7/PlatformV7UniversalAdaptiveStyle.tsx',
  'apps/web/components/platform-v7/PlatformV7ViewportRuntimeGuard.tsx',
  'apps/web/components/platform-v7/PublicBrandLogoFinal.tsx',
  'apps/web/components/platform-v7/PublicEntryCleanup.tsx',
  'apps/web/components/platform-v7/PublicHeaderFinalLock.tsx',
  'apps/web/components/platform-v7/PublicHeroWeightPatch.tsx',
  'apps/web/components/platform-v7/PublicRegistrationEntryPatch.tsx',
  'apps/web/components/platform-v7/ViewportStabilityGuard.tsx',
  'scripts/patch-platform-v7-i18n-runtime.mjs',
  'scripts/patch-platform-v7-i18n.mjs',
];

describe('platform-v7 orphan patch deletion', () => {
  it('physically removes every unreachable DOM, viewport, role and style patch', () => {
    for (const file of removed) expect(fs.existsSync(absolute(file)), file).toBe(false);
  });

  it('keeps the active rendering boundaries free of deleted patch identifiers', () => {
    const sources = [
      read('apps/web/app/platform-v7/layout.tsx'),
      read('apps/web/app/platform-v7/template.tsx'),
      read('apps/web/components/platform-v7/PlatformV7ProtectedRuntime.tsx'),
      read('apps/web/components/platform-v7/PlatformV7DesignSystemV8Runtime.tsx'),
    ].join('\n');
    for (const file of removed.filter((entry) => entry.endsWith('.tsx'))) {
      const symbol = path.basename(file, '.tsx');
      expect(sources).not.toContain(symbol);
    }
    expect(sources).not.toContain('MutationObserver');
    expect(sources).not.toContain('visualViewport');
    expect(sources).not.toContain('dangerouslySetInnerHTML');
  });
});
