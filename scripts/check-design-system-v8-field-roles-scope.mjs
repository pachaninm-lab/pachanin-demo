import { execFileSync } from 'node:child_process';

const exact = new Set([
  '.github/workflows/design-system-v8.yml',
  '.github/workflows/platform-v7-autopilot-guard.yml',
  'apps/web/app/platform-v7/driver/field/page.tsx',
  'apps/web/app/platform-v7/elevator/page.tsx',
  'apps/web/app/platform-v7/lab/page.tsx',
  'apps/web/app/platform-v7/surveyor/page.tsx',
  'apps/web/tests/unit/designSystemV8FieldRoles.test.ts',
  'design-governance-v8.json',
  'scripts/check-design-system-v8-field-roles-scope.mjs',
]);
const prefixes = ['apps/web/components/transaction-ux/'];
const forbidden = [/^apps\/landing\//, /^apps\/api\//, /^packages\//, /^infra\//, /^\.env/, /(?:^|\/)package-lock\.json$/, /(?:^|\/)pnpm-lock\.yaml$/, /\.(?:pem|key)$/];
const normalize = (file) => file.trim().replaceAll('\\', '/').replace(/^\.\//, '');
const allowed = (file) => exact.has(file) || prefixes.some((prefix) => file.startsWith(prefix));
const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
let base = process.env.BASE_REF || 'origin/main';
try { git(['rev-parse', '--verify', base]); } catch { base = 'main'; }
let mergeBase;
try { mergeBase = git(['merge-base', base, 'HEAD']); } catch { console.error(`[design-system-v8-field-roles-scope] Cannot resolve merge base for ${base}.`); process.exit(1); }
const files = git(['diff', '--name-only', `${mergeBase}...HEAD`]).split(/\r?\n/).map(normalize).filter(Boolean);
if (files.length === 0) { console.error('[design-system-v8-field-roles-scope] No changed files found.'); process.exit(1); }
const violations = [];
for (const file of files) {
  if (forbidden.some((pattern) => pattern.test(file))) violations.push(`${file}: forbidden zone`);
  else if (!allowed(file)) violations.push(`${file}: outside approved field-role scope`);
}
if (violations.length) { console.error('[design-system-v8-field-roles-scope] FAIL'); for (const violation of violations) console.error(`- ${violation}`); process.exit(1); }
console.log(`[design-system-v8-field-roles-scope] PASS: ${files.length} changed files are inside the approved scope.`);
for (const file of files) console.log(`- ${file}`);
