import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-reset-http-diagnostic.yml';
const scriptPath = 'scripts/production-p0-reviewer-reset-http-diagnostic.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/production-p0-reviewer-reset-http-diagnostic-3785.json';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

const required = (text, token, label) => {
  if (!text.includes(token)) throw new Error(`missing ${label}: ${token}`);
};
const forbidden = (text, pattern, label) => {
  if (pattern.test(text)) throw new Error(`forbidden ${label}`);
};

required(workflow, "/production p0-reviewer-reset-http-diagnose current-deployed", 'exact owner command');
required(workflow, "github.event.issue.number == 3072", 'release authority');
required(workflow, "github.event.comment.user.login == github.repository_owner", 'owner comment guard');
required(workflow, "github.actor == github.repository_owner", 'owner actor guard');
required(workflow, "github.triggering_actor == github.repository_owner", 'owner rerun guard');
required(workflow, 'persist-credentials: false', 'credentialless checkout');
required(workflow, 'PC_PROD_SSH_HOST_FINGERPRINT', 'pinned SSH fingerprint');
required(script, "EXPECTED_DEPLOYED_SHA='2b1350ff67a988bfc0151c1dbca1038a8389b8b6'", 'fixed deployed baseline');
required(script, 'git merge-base --is-ancestor "$EXPECTED_DEPLOYED_SHA" "$CURRENT_MAIN"', 'deployed ancestor guard');
required(script, '$live_base/platform-v7/forgot-password?lang=ru', 'forgot-password GET');
required(script, 'pc_csrf_token', 'CSRF cookie probe');
required(script, "'{\"email\":\"invalid\",\"locale\":\"ru\"}'", 'non-deliverable invalid input probe');
required(script, 'INVALID_EMAIL', 'invalid-input route contract');
required(script, 'reset request sent: \\`NO\\`', 'no-reset marker');
required(script, 'PRODUCTION_MUTATION=NONE', 'no-mutation marker');
required(script, 'reviewer identity exposure: \\`NONE\\`', 'identity-redaction result');

forbidden(script, /staff_reviewer_password_reset_subject/i, 'reviewer identity DB function');
forbidden(script, /"email"\s*:\s*"[^"\n]*@/i, 'valid email POST body');
forbidden(script, /passwordHash|mfaSecret|totpSecret|resetToken/i, 'credential or reset-token handling');
forbidden(script, /SET\s+ROLE/i, 'SET ROLE');
forbidden(script, /BYPASSRLS|ALTER\s+ROLE|GRANT\s+/i, 'privilege mutation');

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') throw new Error('scope schema mismatch');
if (scope.branch !== 'diag/p0-reviewer-reset-http-3785') throw new Error('scope branch mismatch');
if (scope.issue !== 3785) throw new Error('scope issue mismatch');
if (scope.boundaries?.productionMutation !== 'NONE') throw new Error('scope must be no-mutation');
if (scope.boundaries?.passwordMutation !== false || scope.boundaries?.mfaMutation !== false) {
  throw new Error('credential mutations must remain forbidden');
}
if (scope.boundaries?.newRecurringCostRub !== 0) throw new Error('scope recurring cost must be zero');
const expectedPaths = [workflowPath, scopePath, scriptPath, 'scripts/check-production-p0-reviewer-reset-http-diagnostic.mjs'].sort();
const actualPaths = [...(scope.allowedPaths || [])].sort();
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) throw new Error('scope path set mismatch');

console.log('production-p0-reviewer-reset-http-diagnostic contract: PASS');
