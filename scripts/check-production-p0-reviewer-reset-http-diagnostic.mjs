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

required(workflow, "/production p0-reviewer-reset-http-diagnose current-main", 'exact owner command');
required(workflow, "github.event.issue.number == 3072", 'release authority');
required(workflow, "github.event.comment.user.login == github.repository_owner", 'owner comment guard');
required(workflow, "github.actor == github.repository_owner", 'owner actor guard');
required(workflow, "github.triggering_actor == github.repository_owner", 'owner rerun guard');
required(workflow, 'persist-credentials: false', 'credentialless checkout');
required(workflow, 'PC_PROD_SSH_HOST_FINGERPRINT', 'pinned SSH fingerprint');

required(script, "COMMAND='/production p0-reviewer-reset-http-diagnose current-main'", 'script owner command');
required(script, '[[ "$SOURCE_SHA" == "$CURRENT_MAIN" ]]', 'exact-source main guard');
required(script, 'EXPECTED_DEPLOYED_SHA="$CURRENT_MAIN"', 'exact current-main deployed target');
required(script, 'guard_main()', 'current-main guard function');
required(script, 'for attempt in 1 2 3', 'bounded host-key retries');
required(script, 'ssh-keyscan -T 10 -p "$port" "$host"', 'bounded host-key discovery');
required(script, '[[ "$fingerprint" != "$expected" ]] ||', 'pinned fingerprint match');
required(script, 'StrictHostKeyChecking=yes', 'strict host verification');
required(script, 'UserKnownHostsFile="$known_hosts"', 'bounded known-hosts authority');
required(script, '$live_base/platform-v7/forgot-password?lang=ru', 'forgot-password GET');
required(script, 'pc_csrf_token', 'CSRF cookie probe');
required(script, "'{\"email\":\"invalid\",\"locale\":\"ru\"}'", 'non-deliverable invalid input probe');
required(script, 'INVALID_EMAIL', 'invalid-input route contract');
required(script, "classification='ORIGIN_AND_CSRF_PASS'", 'required production classification');
required(script, "if [[ \"$classification\" == 'ORIGIN_AND_CSRF_PASS' ]]; then", 'strict success classification');
required(script, "[[ \"$result\" == 'PASS_READ_ONLY' ]]", 'strict terminal gate');
required(script, 'reset request sent: \\`NO\\`', 'no-reset marker');
required(script, 'PRODUCTION_MUTATION=NONE', 'no-mutation marker');
required(script, 'reviewer identity exposure: \\`NONE\\`', 'identity-redaction result');

forbidden(workflow, /current-deployed/, 'stale deployed command');
forbidden(script, /EXPECTED_DEPLOYED_SHA='[0-9a-f]{40}'/, 'hard-coded deployed SHA');
forbidden(script, /staff_reviewer_password_reset_subject/i, 'reviewer identity DB function');
forbidden(script, /"email"\s*:\s*"[^"\n]*@/i, 'valid email POST body');
forbidden(script, /passwordHash|mfaSecret|totpSecret|resetToken/i, 'credential or reset-token handling');
forbidden(script, /SET\s+ROLE/i, 'SET ROLE');
forbidden(script, /BYPASSRLS|ALTER\s+ROLE|GRANT\s+/i, 'privilege mutation');
forbidden(script, /StrictHostKeyChecking=no/, 'host verification weakening');
forbidden(script, /UserKnownHostsFile=\/dev\/null/, 'known-hosts bypass');

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') throw new Error('scope schema mismatch');
if (scope.branch !== 'fix/p0-reviewer-reset-http-current-main-3785') throw new Error('scope branch mismatch');
if (scope.issue !== 3785) throw new Error('scope issue mismatch');
if (scope.boundaries?.productionMutation !== 'NONE') throw new Error('scope must be no-mutation');
if (scope.boundaries?.passwordMutation !== false || scope.boundaries?.mfaMutation !== false) {
  throw new Error('credential mutations must remain forbidden');
}
if (scope.boundaries?.newRecurringCostRub !== 0) throw new Error('scope recurring cost must be zero');
const expectedPaths = [workflowPath, scopePath, scriptPath, 'scripts/check-production-p0-reviewer-reset-http-diagnostic.mjs'].sort();
const actualPaths = [...(scope.allowedPaths || [])].sort();
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) throw new Error('scope path set mismatch');

console.log('production-p0-reviewer-reset-http-diagnostic exact-current-main contract: PASS');
