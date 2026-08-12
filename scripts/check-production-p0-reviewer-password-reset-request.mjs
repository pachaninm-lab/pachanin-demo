import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-password-reset-request.yml';
const scriptPath = 'scripts/production-p0-reviewer-password-reset-request.sh';
const migrationPath = 'apps/api/prisma/migrations/20260812154500_p0_reviewer_password_reset_subject/migration.sql';
const scopePath = 'docs/platform-v7/autopilot/scopes/p0-reviewer-password-reset-request-3785.json';

const read = (path) => fs.readFileSync(path, 'utf8');
const workflow = read(workflowPath);
const script = read(scriptPath);
const migration = read(migrationPath);
const scope = JSON.parse(read(scopePath));

const requireAll = (label, haystack, needles) => {
  for (const needle of needles) {
    if (!haystack.includes(needle)) throw new Error(`${label} missing: ${needle}`);
  }
};

const rejectAll = (label, haystack, needles) => {
  for (const needle of needles) {
    if (haystack.includes(needle)) throw new Error(`${label} forbidden: ${needle}`);
  }
};

requireAll('workflow', workflow, [
  "issue_comment:",
  "pull_request:",
  "/production p0-reviewer-reset-request current-main",
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  "github.actor == github.repository_owner",
  "github.triggering_actor == github.repository_owner",
  "scripts/check-production-p0-reviewer-password-reset-request.mjs",
  "scripts/production-p0-reviewer-password-reset-request.sh",
  "PC_PROD_SSH_HOST_FINGERPRINT",
]);
rejectAll('workflow', workflow, [
  'PC_P0_REVIEWER_EMAIL',
  'PC_P0_REVIEWER_PASSWORD',
  'PC_P0_REVIEWER_TOTP',
  'upload-artifact',
  'actions/upload-artifact',
]);

requireAll('script', script, [
  "DEFAULT_HOST='195.19.12.120'",
  "LIVE_DOMAIN='xn----8sbjf4befbjgs9b.xn--p1ai'",
  "StrictHostKeyChecking=yes",
  "staff_reviewer_preflight()",
  "staff_reviewer_login_readiness()",
  "staff_reviewer_password_reset_subject()",
  "counts.join('|') !== '1|1|1|1|1|0|0|0'",
  "/platform-v7/forgot-password?lang=ru",
  "/api/auth/forgot-password",
  "x-csrf-token",
  "Origin: $live_base",
  "--data-binary \"@$request_body\"",
  "password_reset_delivery_result",
  "\"delivered\"[[:space:]]*:[[:space:]]*true",
  "PRODUCTION_MUTATION=NORMAL_PASSWORD_RESET_REQUEST_ONLY",
  "reviewer identity exposure: \\`NONE\\`",
  "password/TOTP handling: \\`NONE\\`",
]);
rejectAll('script', script, [
  'PC_P0_REVIEWER_EMAIL',
  'PC_P0_REVIEWER_PASSWORD',
  'PC_P0_REVIEWER_TOTP',
  'passwordHash =',
  'mfa_secret_ciphertext =',
  'UPDATE public."users"',
  'INSERT INTO public."users"',
  'DELETE FROM public."users"',
]);

if (/printf[^\n]*reviewer_email[^\n]*(?:\\n|%s)/.test(script)
    && !/printf '\{\"email\":\"%s\",\"locale\":\"ru\"\}' \"\$reviewer_email\" > \"\$request_body\"/.test(script)) {
  throw new Error('reviewer email may only be written to the root-only request body');
}
if (/gh issue comment[\s\S]{0,1000}\$reviewer_email/.test(script)) {
  throw new Error('reviewer email must never reach issue comments');
}

requireAll('migration', migration, [
  'CREATE OR REPLACE FUNCTION auth.staff_reviewer_password_reset_subject()',
  'RETURNS text',
  'SECURITY DEFINER',
  'SET row_security = on',
  "assignment.role = 'PLATFORM_OWNER'",
  "assignment.status = 'ACTIVE'",
  "membership_pc_reviewer_internal_v1",
  "org_pc_internal_platform_v1",
  'subject."passwordHash" IS NULL',
  "subject.\"passwordHash\" !~ '^\\$2[aby]\\$[0-9]{2}\\$[./A-Za-z0-9]{53}$'",
  'ALTER FUNCTION auth.staff_reviewer_password_reset_subject() OWNER TO pc_staff_authority',
  'REVOKE ALL ON FUNCTION auth.staff_reviewer_password_reset_subject() FROM PUBLIC',
  'GRANT EXECUTE ON FUNCTION auth.staff_reviewer_password_reset_subject() TO pc_staff_runtime',
  "RAISE EXCEPTION 'reviewer password-reset subject cardinality is %'",
  "RAISE EXCEPTION 'reviewer password-reset subject is not uniquely eligible'",
]);
rejectAll('migration', migration, [
  'UPDATE public."users" SET',
  'INSERT INTO public."users"',
  'DELETE FROM public."users"',
  'ALTER TABLE public."users" DISABLE ROW LEVEL SECURITY',
  'SET row_security = off',
]);

if (scope.schemaVersion !== 'pc.p0.reviewer-password-reset-request.v1') {
  throw new Error('scope schemaVersion invalid');
}
if (scope.productionMutation !== 'NORMAL_PASSWORD_RESET_REQUEST_ONLY') {
  throw new Error('scope productionMutation invalid');
}
if (scope.secretsInActions !== 'FORBIDDEN') throw new Error('scope must forbid reviewer secrets in Actions');
if (!Array.isArray(scope.forbidden) || !scope.forbidden.includes('DIRECT_PASSWORD_DATABASE_WRITE')) {
  throw new Error('scope must forbid direct password database writes');
}

console.log('production P0 reviewer password-reset request contract PASS');
