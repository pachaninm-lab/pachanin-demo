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
required(script, "EXPECTED_DEPLOYED_SHA='3298ef9e7d661102e4b275a777055331a94ce7ff'", 'fixed deployed baseline');
required(script, 'git merge-base --is-ancestor "$EXPECTED_DEPLOYED_SHA" "$TARGET_SHA"', 'ancestor guard');
required(script, "current_user = 'pc_staff_runtime'", 'confined runtime principal');
required(script, "to_regprocedure('auth.staff_reviewer_preflight()')", 'preflight execute probe');
required(script, "to_regprocedure('auth.staff_reviewer_login_readiness()')", 'readiness execute probe');
required(script, "to_regprocedure('auth.staff_reviewer_password_reset_subject()')", 'reset subject execute probe');
required(script, "SELECT * FROM auth.staff_reviewer_preflight()", 'preflight call');
required(script, "SELECT * FROM auth.staff_reviewer_login_readiness()", 'readiness call');
required(script, 'SELECT auth.staff_reviewer_password_reset_subject() IS NOT NULL AS eligible', 'reset subject boolean call');
required(script, 'PRODUCTION_MUTATION|NONE', 'no-mutation marker');
required(script, 'reviewer identity exposure: \\`NONE\\`', 'identity redaction result');
required(script, 'last completed stage:', 'transport classifier');

forbidden(script, /SET\s+ROLE/i, 'SET ROLE');
forbidden(script, /ALTER\s+ROLE[^\n]+BYPASSRLS|GRANT\s+[^\n]+BYPASSRLS/i, 'RLS bypass');
forbidden(script, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\s+(?:INTO\s+|FROM\s+)?(?:public|auth)\./i, 'persistent database write');
forbidden(script, /process\.stdout\.write\([^\n]*(?:email|token|password|totp|databaseUrl)/i, 'identity or secret stdout');
forbidden(script, /gh\s+issue\s+comment[^\n]*(?:email|token|passwordHash|totp|databaseUrl)/i, 'identity or secret issue output');

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') throw new Error('scope schema mismatch');
if (scope.branch !== 'diag/p0-reviewer-reset-db-stage-classifier-3785') throw new Error('scope branch mismatch');
if (scope.issue !== 3785) throw new Error('scope issue mismatch');
if (scope.boundaries?.productionMutation !== 'NONE') throw new Error('scope must be no-mutation');
if (scope.boundaries?.newRecurringCostRub !== 0) throw new Error('scope recurring cost must be zero');
const expectedPaths = [workflowPath, scopePath, scriptPath, 'scripts/check-production-p0-reviewer-reset-db-stage-classifier.mjs'].sort();
const actualPaths = [...(scope.allowedPaths || [])].sort();
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) throw new Error('scope path set mismatch');

console.log('production-p0-reviewer-reset-db-stage-classifier contract: PASS');
