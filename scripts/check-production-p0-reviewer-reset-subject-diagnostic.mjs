import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-subject-diagnostic.yml';
const scriptPath = 'scripts/production-p0-reviewer-reset-subject-diagnostic.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-subject-diagnostic-3785.json';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

const required = (text, token, label) => {
  if (!text.includes(token)) throw new Error(`missing ${label}: ${token}`);
};
const forbidden = (text, pattern, label) => {
  if (pattern.test(text)) throw new Error(`forbidden ${label}`);
};

required(workflow, "/production p0-reviewer-reset-subject-diagnose current-main", 'exact owner command');
required(workflow, "github.event.issue.number == 3072", 'release authority');
required(workflow, "github.event.comment.user.login == github.repository_owner", 'owner comment guard');
required(workflow, "github.actor == github.repository_owner", 'owner actor guard');
required(workflow, "github.triggering_actor == github.repository_owner", 'owner rerun guard');
required(workflow, 'persist-credentials: false', 'credentialless checkout');
required(workflow, 'PC_PROD_SSH_HOST_FINGERPRINT', 'pinned SSH fingerprint');
required(script, "EXPECTED_DEPLOYED_SHA='unknown'", 'uninitialized deployed target');
required(script, 'EXPECTED_DEPLOYED_SHA="$TARGET_SHA"', 'exact current-main deployed binding');
required(script, '[[ "$EXPECTED_DEPLOYED_SHA" == "$TARGET_SHA" ]]', 'exact deployed target equality');
required(script, '[[ "$api_revision" == "$expected_sha" && "$web_revision" == "$expected_sha" ]]', 'exact API/Web production parity');
required(script, "has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'SELECT')", 'assignment ACL probe');
required(script, "has_column_privilege('pc_staff_authority', 'public.users', 'email', 'SELECT')", 'user column ACL probe');
required(script, "has_function_privilege('pc_staff_runtime', 'auth.staff_reviewer_password_reset_subject()', 'EXECUTE')", 'function execute probe');
required(script, "policyname = 'users_staff_reviewer_password_reset_subject'", 'users reset policy probe');
required(script, "policyname = 'user_orgs_staff_reviewer_password_reset_subject'", 'membership reset policy probe');
required(script, "policyname = 'organizations_staff_reviewer_password_reset_subject'", 'organization reset policy probe');
required(script, 'SELECT auth.staff_reviewer_password_reset_subject() IS NOT NULL AS eligible', 'non-PII function probe');
required(script, 'PRODUCTION_MUTATION=NONE', 'no-mutation marker');
required(script, 'reviewer identity exposure: \\`NONE\\`', 'identity-redaction result');

forbidden(script, /EXPECTED_DEPLOYED_SHA='[0-9a-f]{40}'/, 'hard-coded deployed SHA');
forbidden(script, /git merge-base --is-ancestor\s+"\$EXPECTED_DEPLOYED_SHA"/, 'stale ancestor-only production gate');
forbidden(script, /SET\s+ROLE/i, 'SET ROLE');
forbidden(script, /BYPASSRLS\s*;|ALTER\s+ROLE[^\n]+BYPASSRLS/i, 'RLS bypass');
forbidden(script, /SELECT\s+[^;]*(?:"email"|\.email)\s+FROM\s+public\."?users"?/i, 'reviewer email row read');
forbidden(script, /process\.stdout\.write\([^\n]*(?:email|token|password|totp)/i, 'secret/identity stdout');
forbidden(script, /gh\s+issue\s+comment[^\n]*(?:email|token|passwordHash|totp)/i, 'secret/identity issue output');

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') throw new Error('scope schema mismatch');
if (scope.branch !== 'diag/p0-reviewer-reset-subject-acl-3785') throw new Error('scope branch mismatch');
if (scope.issue !== 3785) throw new Error('scope issue mismatch');
if (scope.boundaries?.productionMutation !== 'NONE') throw new Error('scope must be no-mutation');
if (scope.boundaries?.newRecurringCostRub !== 0) throw new Error('scope recurring cost must be zero');
const expectedPaths = [workflowPath, scopePath, 'scripts/check-production-p0-reviewer-reset-subject-diagnostic.mjs', scriptPath].sort();
const actualPaths = [...(scope.allowedPaths || [])].sort();
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) throw new Error('scope path set mismatch');

console.log('production-p0-reviewer-reset-subject-diagnostic contract: PASS');
