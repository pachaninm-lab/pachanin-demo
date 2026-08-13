import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-db-stage-classifier.yml';
const scriptPath = 'scripts/production-p0-reviewer-reset-db-stage-classifier.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-db-stage-classifier-3785.json';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

const required = (text, token, label) => {
  if (!text.includes(token)) throw new Error(`missing ${label}: ${token}`);
};
const forbidden = (text, pattern, label) => {
  if (pattern.test(text)) throw new Error(`forbidden ${label}`);
};

required(workflow, '/production p0-reviewer-reset-db-stage-classify current-main', 'exact owner command');
required(workflow, 'github.event.issue.number == 3072', 'release authority');
required(workflow, 'github.event.comment.user.login == github.repository_owner', 'owner comment guard');
required(workflow, 'github.actor == github.repository_owner', 'owner actor guard');
required(workflow, 'github.triggering_actor == github.repository_owner', 'owner rerun guard');
required(workflow, 'persist-credentials: false', 'credentialless checkout');
required(workflow, 'PC_PROD_SSH_HOST_FINGERPRINT', 'pinned SSH fingerprint');
required(script, "EXPECTED_DEPLOYED_SHA='d2dd7972105cc59002263455b5ae0eb8d8f2d386'", 'proven deployed baseline');
required(script, '[[ "$(git rev-parse HEAD)" == "$TARGET_SHA" ]]', 'exact checkout guard');
required(script, '[[ "$(git rev-parse origin/main)" == "$TARGET_SHA" ]]', 'exact origin main guard');
required(script, 'git merge-base --is-ancestor "$EXPECTED_DEPLOYED_SHA" "$TARGET_SHA"', 'deployed revision ancestry guard');
required(script, 'for attempt in 1 2 3; do', 'bounded host-key discovery retry');
required(script, '[[ "$pinned_ready" == \'1\' ]]', 'pinned host-key retry terminal guard');
required(script, 'StrictHostKeyChecking=yes', 'strict SSH host verification');
required(script, "current_user = 'pc_staff_runtime'", 'confined runtime principal');
required(script, "to_regprocedure('auth.staff_reviewer_preflight()')", 'preflight execute probe');
required(script, "to_regprocedure('auth.staff_reviewer_login_readiness()')", 'readiness execute probe');
required(script, "to_regprocedure('auth.staff_reviewer_password_reset_subject()')", 'reset subject execute probe');
required(script, "SELECT * FROM auth.staff_reviewer_preflight()", 'preflight call');
required(script, 'Number(r?.active_owner_count) === 1', 'exact active owner count');
required(script, 'Number(r?.usable_reviewer_count) === 1', 'exact usable reviewer count');
required(script, "SELECT * FROM auth.staff_reviewer_login_readiness()", 'readiness call');
required(script, 'const expected = [1, 1, 1, 0, 0, 0];', 'exact login-readiness vector');
required(script, 'Number(r?.[name]) === expected[index]', 'exact readiness comparison');
required(script, "result('PREFLIGHT_CALL', ok, ok ? '' : 'UNEXPECTED')", 'preflight unexpected-state classifier');
required(script, "result('READINESS_CALL', ok, ok ? '' : 'UNEXPECTED')", 'readiness unexpected-state classifier');
required(script, 'SELECT auth.staff_reviewer_password_reset_subject() IS NOT NULL AS eligible', 'reset subject boolean call');
required(script, "process.env.DATABASE_URL", 'auth database URL boundary');
required(script, "has_table_privilege(current_user, 'auth.password_reset_challenges', 'SELECT')", 'challenge read privilege probe');
required(script, "has_table_privilege(current_user, 'auth.audit_events', 'SELECT')", 'audit read privilege probe');
required(script, "to_regprocedure('auth.resolve_password_reset_subject(text)')", 'password reset subject resolver execute probe');
required(script, 'SELECT user_id FROM auth.resolve_password_reset_subject($1)', 'auth subject call');
required(script, 'FROM auth.password_reset_challenges', 'challenge read stage');
required(script, 'FROM auth.audit_events', 'audit read stage');
required(script, "result('AUTH_PRINCIPAL'", 'auth principal classifier');
required(script, "result('AUTH_SUBJECT_CALL'", 'auth subject classifier');
required(script, "result('CHALLENGE_READ'", 'challenge classifier');
required(script, "result('AUDIT_READ'", 'audit classifier');
required(script, 'PRODUCTION_MUTATION|NONE', 'no-mutation marker');
required(script, 'reviewer identity exposure: \\`NONE\\`', 'identity redaction result');
required(script, 'last completed stage:', 'transport classifier');

forbidden(script, /EXPECTED_DEPLOYED_SHA='2b1350ff67a988bfc0151c1dbca1038a8389b8b6'/, 'stale deployed SHA');
forbidden(script, /EXPECTED_DEPLOYED_SHA="\$TARGET_SHA"/, 'unnecessary current-main production binding');
forbidden(script, /SET\s+ROLE/i, 'SET ROLE');
forbidden(script, /ALTER\s+ROLE[^\n]+BYPASSRLS|GRANT\s+[^\n]+BYPASSRLS/i, 'RLS bypass');
forbidden(script, /ALTER\s+ROLE[^\n;]*\bSUPERUSER\b/i, 'SUPERUSER escalation');
forbidden(script, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\s+(?:INTO\s+|FROM\s+)?(?:public|auth)\./i, 'persistent database write');
forbidden(script, /process\.stdout\.write\([^\n]*(?:email|token|password|totp|databaseUrl)/i, 'identity or secret stdout');
forbidden(script, /gh\s+issue\s+comment[^\n]*(?:email|token|passwordHash|totp|databaseUrl)/i, 'identity or secret issue output');

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') throw new Error('scope schema mismatch');
if (scope.branch !== 'fix/p0-reviewer-reset-db-stage-exact-main-3785') throw new Error('scope branch mismatch');
if (scope.issue !== 3785) throw new Error('scope issue mismatch');
if (scope.boundaries?.productionMutation !== 'NONE') throw new Error('scope must be no-mutation');
if (scope.boundaries?.newRecurringCostRub !== 0) throw new Error('scope recurring cost must be zero');
const expectedPaths = [workflowPath, scopePath, scriptPath, 'scripts/check-production-p0-reviewer-reset-db-stage-classifier.mjs'].sort();
const actualPaths = [...(scope.allowedPaths || [])].sort();
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) throw new Error('scope path set mismatch');

console.log('production-p0-reviewer-reset-db-stage-classifier contract: PASS');