import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const symbol = (...parts) => parts.join('');

const forbiddenFiles = [
  'apps/web/components/platform-v7/PlatformV7FullStyleRuntime.tsx',
  'apps/web/components/platform-v7/PlatformV7ProtectedTemplateRuntime.tsx',
  'apps/web/components/platform-v7/PlatformV7TemplateGuards.tsx',
  'apps/web/components/platform-v7/PlatformV7TemplateSwitch.tsx',
  'apps/web/components/platform-v7/PlatformV7ProductionCopyPatch.tsx',
  'apps/web/components/platform-v7/PlatformV7ScrollRestorationGuard.tsx',
  'apps/web/components/platform-v7/ScopedShellGuard.tsx',
  'apps/web/components/platform-v7/PlatformV7ViewportRuntimeGuard.tsx',
  'apps/web/components/platform-v7/PlatformV7UniversalAdaptiveStyle.tsx',
  'apps/web/components/platform-v7/PlatformV7BlankScreenGuard.tsx',
  'apps/web/components/platform-v7/PlatformV7InteractionFixes.tsx',
  'apps/web/components/platform-v7/PlatformV7MobileFinalGuard.tsx',
  'apps/web/components/platform-v7/PlatformV7RoleLockFix.tsx',
  'apps/web/components/platform-v7/ViewportStabilityGuard.tsx',
  'apps/web/components/platform-v7/MobileLogoutSoftExit.tsx',
  'apps/web/components/platform-v7/LoginMobileStabilityStyle.tsx',
  'apps/web/components/platform-v7/LoginHeaderLogoGuard.tsx',
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
  'apps/web/components/v7r/ShellCopyNormalizer.tsx',
  'apps/web/components/v7r/AiShellEnhancer.tsx',
  'apps/web/components/v7r/PlatformV7NotificationCenter.tsx',
  'apps/web/lib/platform-v7/shellNotificationCenter.ts',
  'scripts/patch-platform-v7-i18n-runtime.mjs',
  'scripts/patch-platform-v7-i18n.mjs',
  'apps/web/styles/platform-v7-dark-role-fixes.css',
  'apps/web/styles/platform-v7-shell-clarity.css',
  'apps/web/styles/platform-v7-work-surfaces.css',
  'apps/web/styles/platform-v7-mobile-excellence.css',
  'apps/web/styles/platform-v7-premium-visual-polish.css',
  'apps/web/styles/platform-v7-final-polish.css',
  'apps/web/styles/platform-v7-living-deal.css',
  'apps/web/styles/platform-v7-premium-cockpit.css',
  'apps/web/styles/platform-v7-entry-fix.css',
  'apps/web/styles/platform-v7-mobile-hardening.css',
  'apps/web/styles/platform-v7-mobile-reflow-p0.css',
  'apps/web/styles/platform-v7-shell-restore.css',
  'apps/web/styles/platform-v7-register-header-override.css',
  'apps/web/styles/platform-v7-mobile-screenshot-fixes.css',
  'apps/web/styles/platform-v7-mobile-shell-p1.css',
  'apps/web/styles/platform-v7-shell-critical.css',
  'apps/web/styles/platform-v7-seller-mobile-usability.css',
  'apps/web/styles/platform-v7-mobile-bottom-tools.css',
  'apps/web/styles/platform-v7-seller-workspace-v2.css',
  'apps/web/styles/platform-v7-protected-grid-stable.css',
  'apps/web/styles/platform-v7-control-tower-mobile.css',
  'apps/web/styles/platform-v7-bank-mobile.css',
  'apps/web/styles/platform-v7-elevator-mobile.css',
  'apps/web/styles/platform-v7-lab-mobile.css',
  'apps/web/styles/platform-v7-compliance-mobile.css',
  'apps/web/styles/platform-v7-arbitrator-mobile.css',
  'apps/web/styles/platform-v7-executive-mobile.css',
  'apps/web/styles/platform-v7-clean-deal-mobile.css',
  'apps/web/styles/platform-v7-offer-to-deal-mobile.css',
  'apps/web/styles/platform-v7-stable-shell.css',
  'apps/web/styles/platform-v7-viewport-stability.css',
  'apps/web/styles/platform-v7-adaptive-devices.css',
  'apps/web/styles/platform-v7-support-chat-polish.css',
  'apps/web/styles/platform-v7-final-viewport-cleanup.css',
  'apps/web/styles/platform-v7-contextual-wheat-backgrounds.css',
];

const forbiddenTokens = [
  symbol('PlatformV7', 'FullStyleRuntime'),
  symbol('PlatformV7', 'ProtectedTemplateRuntime'),
  symbol('PlatformV7', 'TemplateGuards'),
  symbol('PlatformV7', 'TemplateSwitch'),
  symbol('PlatformV7', 'ProductionCopyPatch'),
  symbol('PlatformV7', 'ScrollRestorationGuard'),
  symbol('Scoped', 'ShellGuard'),
  symbol('Shell', 'CopyNormalizer'),
  symbol('Ai', 'ShellEnhancer'),
  symbol('PlatformV7', 'NotificationCenter'),
  symbol('PlatformV7', 'I18nGuard'),
  symbol('Platform', 'Translator'),
  symbol('V7Register', 'ExactPatch'),
  symbol('Public', 'EntryCleanup'),
  symbol('Public', 'HeaderFinalLock'),
  symbol('Public', 'HeroWeightPatch'),
  symbol('Public', 'RegistrationEntryPatch'),
  symbol('Public', 'MobileLandingFix'),
  symbol('Public', 'DealPathCtaGuard'),
  symbol('Driver', 'FieldShellGuard'),
  symbol('Seller', 'MobileFix'),
  symbol('System', 'RouteSummaryGate'),
  symbol('Role', 'ExecutionSummaryGate'),
  symbol('Mobile', 'DealFocus'),
  symbol('Mobile', 'DealActionLens'),
  symbol('Mobile', 'HeaderUtilities'),
  symbol('Mobile', 'HeaderActionRail'),
  symbol('NORMALIZED_', 'RUNTIME_COPY'),
  symbol('stabilize', 'DarkSurfaces'),
  symbol('data-p7-', 'dark-fixed'),
  'platform-v7-dark-role-fixes.css',
];

const productionRoots = [
  'apps/web/app/platform-v7',
  'apps/web/components/platform-v7',
  'apps/web/components/v7r',
  'apps/web/lib/platform-v7',
];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css']);
const violations = [];

for (const relativePath of forbiddenFiles) {
  if (fs.existsSync(path.join(repoRoot, relativePath))) {
    violations.push(`${relativePath}: forbidden legacy runtime artifact still exists`);
  }
}

function walk(relativeDirectory) {
  const absoluteDirectory = path.join(repoRoot, relativeDirectory);
  if (!fs.existsSync(absoluteDirectory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...walk(relativePath));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(relativePath);
  }
  return files;
}

for (const relativePath of productionRoots.flatMap(walk)) {
  const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  for (const token of forbiddenTokens) {
    if (source.includes(token)) violations.push(`${relativePath}: forbidden legacy token ${token}`);
  }
}

const criticalShellFiles = [
  'apps/web/app/platform-v7/layout.tsx',
  'apps/web/app/platform-v7/template.tsx',
  'apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx',
  'apps/web/components/platform-v7/PlatformV7LayoutClient.tsx',
  'apps/web/components/platform-v7/PlatformV7DesignSystemV8Runtime.tsx',
];
const forbiddenCriticalPatterns = [
  'MutationObserver',
  'ResizeObserver',
  'visualViewport',
  'requestAnimationFrame',
  'createTreeWalker',
  'getComputedStyle',
  'style.setProperty',
  'dangerouslySetInnerHTML',
];

for (const relativePath of criticalShellFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  const source = fs.readFileSync(absolutePath, 'utf8');
  for (const token of forbiddenCriticalPatterns) {
    if (source.includes(token)) violations.push(`${relativePath}: forbidden shell patch primitive ${token}`);
  }
}

if (violations.length) {
  console.error('[platform-v7-legacy-runtime-zero] FAIL');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`[platform-v7-legacy-runtime-zero] PASS: ${forbiddenFiles.length} forbidden artifacts absent; production references are zero.`);
