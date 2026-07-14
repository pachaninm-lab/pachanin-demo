import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const absolute = (relativePath: string) => path.join(root, relativePath);
const read = (relativePath: string) => fs.readFileSync(absolute(relativePath), 'utf8');

const shell = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx');
const layoutClient = read('apps/web/components/platform-v7/PlatformV7LayoutClient.tsx');
const css = read('apps/web/components/platform-v7/PlatformV7ProtectedShell.module.css');
const zeroGate = read('scripts/check-design-system-v8-zero-reference.mjs');

const removed = [
  'apps/web/components/platform-v7/ScopedShellGuard.tsx',
  'apps/web/components/platform-v7/PublicBrandLogoFinal.tsx',
  'apps/web/components/platform-v7/PublicEntryCleanup.tsx',
  'apps/web/components/platform-v7/PublicHeaderFinalLock.tsx',
  'apps/web/components/platform-v7/PublicHeroWeightPatch.tsx',
  'apps/web/components/platform-v7/PublicRegistrationEntryPatch.tsx',
  'apps/web/components/platform-v7/PublicMobileLandingFix.tsx',
  'apps/web/components/platform-v7/PublicDealPathCtaGuard.tsx',
  'apps/web/components/platform-v7/SellerMobileFix.tsx',
  'apps/web/components/platform-v7/DriverFieldShellGuard.tsx',
  'apps/web/components/platform-v7/PlatformV7I18nGuard.tsx',
  'apps/web/components/platform-v7/PlatformTranslator.tsx',
  'apps/web/components/platform-v7/V7RegisterExactPatch.tsx',
  'apps/web/components/platform-v7/SystemRouteSummaryGate.tsx',
  'apps/web/components/platform-v7/RoleExecutionSummaryGate.tsx',
  'apps/web/components/platform-v7/ExecutionHelpEntry.tsx',
  'apps/web/components/platform-v7/MobileDealFocus.tsx',
  'apps/web/components/platform-v7/MobileDealActionLens.tsx',
  'apps/web/components/platform-v7/MobileHeaderUtilities.tsx',
  'apps/web/components/platform-v7/MobileHeaderActionRail.tsx',
  'apps/web/components/v7r/AiShellEnhancer.tsx',
  'apps/web/components/v7r/PlatformV7NotificationCenter.tsx',
];

describe('platform-v7 static shell policy and final patch deletion', () => {
  it('derives presentation policy from the server-verified role and current protected path', () => {
    expect(shell).toContain("import { getShellPolicy } from '@/lib/platform-v7/shell-role-policy'");
    expect(shell).toContain('const shellPolicy = getShellPolicy(verifiedRole, normalizedPath)');
    expect(shell).toContain('data-shell-policy={shellPolicy}');
    expect(shell).toContain('data-shell-role={verifiedRole}');
    expect(layoutClient).toContain('const shellPolicy = getShellPolicy(initialRole, normalizedPath)');
    expect(layoutClient).toContain('data-shell-policy={shellPolicy}');
    expect(shell).not.toContain('ScopedShellGuard');
    expect(layoutClient).not.toContain('ScopedShellGuard');
  });

  it('uses static scoped CSS instead of client style injection', () => {
    expect(css).toContain("[data-shell-policy='field']");
    expect(css).toContain("[data-shell-policy='role-scoped']");
    expect(css).toContain("[data-shell-role='buyer']");
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).not.toContain('!important');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(shell).not.toContain('dangerouslySetInnerHTML');
    expect(shell).not.toContain('MutationObserver');
    expect(shell).not.toContain('visualViewport');
  });

  it('physically removes every confirmed zero-reference public, role and notification patch', () => {
    for (const file of removed) expect(fs.existsSync(absolute(file)), file).toBe(false);
  });

  it('keeps the zero-reference gate responsible for the deleted layer', () => {
    for (const file of removed) expect(zeroGate).toContain(file);
    expect(zeroGate).toContain('dangerouslySetInnerHTML');
    expect(zeroGate).toContain('production references are zero');
  });
});
