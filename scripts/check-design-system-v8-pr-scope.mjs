import { execFileSync } from 'node:child_process';

const exact = new Set([
  '.github/workflows/design-system-v8.yml',
  '.github/workflows/platform-v7-autopilot-guard.yml',
  'apps/api/src/modules/auth/auth.controller.ts',
  'apps/api/src/modules/auth/auth.module.ts',
  'apps/api/src/modules/auth/organization-team.service.ts',
  'apps/api/src/modules/auth/organization-team.service.spec.ts',
  'apps/web/app/platform-v7/layout.tsx',
  'apps/web/app/platform-v7/template.tsx',
  'apps/web/app/platform-v7/_styles/fixed-header-contract.css',
  'apps/web/app/platform-v7/control-tower/page.tsx',
  'apps/web/app/platform-v7/status/page.tsx',
  'apps/web/app/platform-v7/connectors/page.tsx',
  'apps/web/app/platform-v7/api-docs/page.tsx',
  'apps/web/app/platform-v7/onboarding/page.tsx',
  'apps/web/app/platform-v7/profile/page.tsx',
  'apps/web/app/platform-v7/profile/team/page.tsx',
  'apps/web/app/platform-v7/reports/page.tsx',
  'apps/web/app/platform-v7/driver/field/page.tsx',
  'apps/web/app/platform-v7/elevator/page.tsx',
  'apps/web/app/platform-v7/lab/page.tsx',
  'apps/web/app/platform-v7/surveyor/page.tsx',
  'apps/web/app/platform-v7/seller/page.tsx',
  'apps/web/app/platform-v7/buyer/page.tsx',
  'apps/web/app/platform-v7/bank/page.tsx',
  'apps/web/app/platform-v7/operator/page.tsx',
  'apps/web/app/platform-v7/operator-cockpit/queues/page.tsx',
  'apps/web/app/platform-v7/logistics/page.tsx',
  'apps/web/app/platform-v7/compliance/page.tsx',
  'apps/web/app/platform-v7/arbitrator/page.tsx',
  'apps/web/app/platform-v7/executive/page.tsx',
  'apps/web/app/platform-v7/deals/page.tsx',
  'apps/web/app/platform-v7/deals/deals.module.css',
  'apps/web/app/platform-v7/documents/page.tsx',
  'apps/web/app/platform-v7/disputes/page.tsx',
  'apps/web/app/platform-v7/bank/release-safety/page.tsx',
  'apps/web/app/platform-v7/money/page.tsx',
  'apps/web/app/platform-v7/fgis-access/page.tsx',
  'apps/web/app/platform-v7/auction/page.tsx',
  'apps/web/app/platform-v7/auction/import/page.tsx',
  'apps/web/app/platform-v7/auction/admission/page.tsx',
  'apps/web/app/platform-v7/auction/bids/page.tsx',
  'apps/web/app/platform-v7/auction/deal-basis/page.tsx',
  'apps/web/app/platform-v7/deal-logistics/page.tsx',
  'apps/web/app/platform-v7/deal-acceptance/page.tsx',
  'apps/web/app/platform-v7/deal-documents-basis/page.tsx',
  'apps/web/components/platform-v7/ApiDocPanel.tsx',
  'apps/web/components/platform-v7/ApiKeysPanel.tsx',
  'apps/web/components/platform-v7/FgisZernoPanel.tsx',
  'apps/web/components/platform-v7/MfaSecurityPanel.tsx',
  'apps/web/components/platform-v7/RegulatoryReportsPanel.tsx',
  'apps/web/components/platform-v7/CanonicalDealsList.tsx',
  'apps/web/components/platform-v7/CanonicalDealsList.module.css',
  'apps/web/components/platform-v7/NextActionCard.tsx',
  'apps/web/components/platform-v7/OperatorExecutionQueue.tsx',
  'apps/web/components/platform-v7/PlatformV7DesignSystemV8Runtime.tsx',
  'apps/web/components/platform-v7/PlatformV7FullStyleRuntime.tsx',
  'apps/web/components/platform-v7/PlatformV7ProtectedRuntime.tsx',
  'apps/web/components/platform-v7/PlatformV7ProtectedShell.tsx',
  'apps/web/components/platform-v7/PlatformV7ShellSwitch.tsx',
  'apps/web/components/platform-v7/RoleIntentDashboard.tsx',
  'apps/web/components/platform-v7/RoleIntentDashboard.module.css',
  'apps/web/components/v7r/AppShellV4.tsx',
  'apps/web/components/v7r/AppShellV4.module.css',
  'apps/web/lib/auction-server.ts',
  'apps/web/lib/logistics-server.ts',
  'apps/web/lib/deal-execution-server.ts',
  'apps/web/lib/bank-release-server.ts',
  'apps/web/lib/disputes-server.ts',
  'apps/web/lib/integrations-server.ts',
  'apps/web/lib/auth-profile-server.ts',
  'apps/web/lib/reporting-server.ts',
  'apps/web/lib/organization-team-server.ts',
  'apps/web/lib/platform-v7/design-system-v8-route-policy.ts',
  'apps/web/lib/platform-v7/operator-execution-queue.ts',
  'apps/web/lib/platform-v7/fgisAuctionEngine.ts',
  'apps/web/lib/platform-v7/fgisAuctionAdapter.ts',
  'apps/web/lib/platform-v7/farmerFgisAccessEngine.ts',
  'apps/web/lib/platform-v7/auctionDealBridge.ts',
  'apps/web/lib/platform-v7/dealLogisticsEngine.ts',
  'apps/web/lib/platform-v7/dealAcceptanceEngine.ts',
  'apps/web/lib/platform-v7/dealDocumentBasisEngine.ts',
  'apps/web/tests/unit/bankReleaseSafetyRoute.test.tsx',
  'apps/web/tests/unit/bankReleaseServer.test.ts',
  'apps/web/tests/unit/designSystemV8AuctionRoutes.test.ts',
  'apps/web/tests/unit/designSystemV8CriticalRoutes.test.ts',
  'apps/web/tests/unit/designSystemV8DocumentsRoute.test.ts',
  'apps/web/tests/unit/designSystemV8FieldRoles.test.ts',
  'apps/web/tests/unit/designSystemV8Foundation.test.ts',
  'apps/web/tests/unit/designSystemV8MoneyRoles.test.ts',
  'apps/web/tests/unit/designSystemV8OperationalRoles.test.ts',
  'apps/web/tests/unit/designSystemV8PhysicalExecutionChain.test.ts',
  'apps/web/tests/unit/designSystemV8SettlementViews.test.ts',
  'apps/web/tests/unit/platformV7ApiDocsAuthority.test.ts',
  'apps/web/tests/unit/platformV7ApiDocsLegacyIsolation.test.ts',
  'apps/web/tests/unit/platformV7OnboardingAuthority.test.ts',
  'apps/web/tests/unit/platformV7ProfileTeamAuthority.test.ts',
  'apps/web/tests/unit/platformV7OrganizationTeamAuthority.test.ts',
  'apps/web/tests/unit/platformV7OperatorQueuesCanonicalRoute.test.ts',
  'apps/web/tests/unit/platformV7CanonicalDealWorkspace.test.ts',
  'apps/web/tests/unit/platformV7ConnectorsAuthority.test.ts',
  'apps/web/tests/unit/platformV7ProfileAuthority.test.ts',
  'apps/web/tests/unit/platformV7ReportsAuthority.test.ts',
  'apps/web/tests/unit/platformV7DealExecutionChain.test.ts',
  'apps/web/tests/unit/platformV7DesignSystemV8RuntimeIsolation.test.ts',
  'apps/web/tests/unit/platformV7Dl9106ReleaseReviewPageCurrentMain.test.tsx',
  'apps/web/tests/unit/platformV7FgisAccessFlow.test.ts',
  'apps/web/tests/unit/platformV7HiddenDetails.test.ts',
  'apps/web/tests/unit/platformV7MobileNavigation.test.ts',
  'apps/web/tests/unit/platformV7OperatorExecutionQueue.test.ts',
  'apps/web/tests/unit/platformV7RealDealsRegistry.test.ts',
  'apps/web/tests/unit/platformV7RoleIntentDashboard.test.ts',
  'apps/web/tests/unit/platformV7ServerVerifiedShell.test.ts',
  'apps/web/tests/unit/platformV7ShellNotificationAuthority.test.ts',
  'apps/web/tests/unit/platformV7StatusAuthority.test.ts',
  'apps/web/tests/unit/platformV7TodayWorkspace.test.ts',
  'apps/web/tests/unit/transactionRoleCockpitsV8.test.ts',
  'apps/web/tests/unit/transactionUxV8Migration.test.ts',
  'apps/web/tsconfig.json',
  'design-governance-v8.json',
  'docs/platform-v7/design-system-v8-governance.md',
  'package.json',
  'pnpm-workspace.yaml',
  'scripts/check-design-system-v8.mjs',
  'scripts/check-design-system-v8-pr-scope.mjs',
  'scripts/p7-autopilot-guard.sh',
]);

const prefixes = [
  'apps/web/components/transaction-ux/',
  'packages/design-system-v8/',
  'packages/design-tokens/',
];

const forbidden = [
  /^apps\/landing\//,
  /^packages\/domain-core\//,
  /^infra\//,
  /^\.env/,
  /(?:^|\/)package-lock\.json$/,
  /(?:^|\/)pnpm-lock\.yaml$/,
  /\.(?:pem|key)$/,
];

function normalize(file) {
  return file.trim().replaceAll('\\', '/').replace(/^\.\//, '');
}

function allowed(file) {
  return exact.has(file) || prefixes.some((prefix) => file.startsWith(prefix));
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

let base = process.env.BASE_REF || 'origin/main';
try {
  git(['rev-parse', '--verify', base]);
} catch {
  base = 'main';
}

let mergeBase;
try {
  mergeBase = git(['merge-base', base, 'HEAD']);
} catch {
  console.error(`[design-system-v8-scope] Cannot resolve merge base for ${base}.`);
  process.exit(1);
}

const files = git(['diff', '--name-only', `${mergeBase}...HEAD`])
  .split(/\r?\n/)
  .map(normalize)
  .filter(Boolean);

if (files.length === 0) {
  console.error('[design-system-v8-scope] No changed files found.');
  process.exit(1);
}

const violations = [];
for (const file of files) {
  if (forbidden.some((pattern) => pattern.test(file))) {
    violations.push(`${file}: forbidden zone`);
    continue;
  }
  if (!allowed(file)) violations.push(`${file}: outside approved Design System v8 scope`);
}

if (violations.length > 0) {
  console.error('[design-system-v8-scope] FAIL');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`[design-system-v8-scope] PASS: ${files.length} changed files are inside the approved scope.`);
for (const file of files) console.log(`- ${file}`);
