#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const paths = {
  workflow: '.github/workflows/tai-owner-public-non-tai-acl-repair.yml',
  repair: 'scripts/tai-public-non-tai-acl-repair.sh',
  checker: 'scripts/check-tai-public-non-tai-acl-repair.mjs',
  scope: 'docs/platform-v7/autopilot/scopes/tai-public-non-tai-acl-repair-20260803.json',
};
const workflow = readFileSync(paths.workflow, 'utf8');
const repair = readFileSync(paths.repair, 'utf8');
const scope = JSON.parse(readFileSync(paths.scope, 'utf8'));
const violations = [];
const requireFragment = (source, fragment, label) => {
  if (!source.includes(fragment)) violations.push(`${label}: missing ${JSON.stringify(fragment)}`);
};
const forbid = (source, pattern, label) => {
  if (pattern.test(source)) violations.push(label);
};

for (const fragment of [
  'name: TAI Owner PUBLIC Non-TAI ACL Repair',
  "github.event.issue.number == 3365",
  "github.event.comment.body == '/tai repair-public-non-tai-acls current-main'",
  '[[ "$COMMENTER" == "$OWNER" ]]',
  '[[ "$ACTOR" == "$OWNER" ]]',
  '[[ "$TRIGGERING_ACTOR" == "$OWNER" ]]',
  'status?per_page=100',
  "['TAI Controller Sync', 'TAI REG.RU Preflight']",
  'runs-on: ubuntu-24.04',
  'DEFAULT_HOST: 195.19.12.120',
  'StrictHostKeyChecking=yes',
  'scripts/tai-public-non-tai-acl-repair.sh',
  'scripts/production-full-stack-live-acceptance.sh',
  'scripts/production-full-stack-exact-sha.sh',
  "'$remote_script' apply '$TARGET_SHA' '$GITHUB_RUN_ID' '$remote_evidence'",
  'LIVE_ACCEPTANCE=PASS',
  'DURABLE_INTAKE_DB=PASS',
  "'$remote_script' finalize '$TARGET_SHA' '$GITHUB_RUN_ID' '$remote_evidence'",
  "'$remote_script' rollback '$TARGET_SHA' '$GITHUB_RUN_ID' '$remote_evidence'",
  "steps.live.outcome != 'success'",
  "steps.database.outcome != 'success'",
  "steps.finalize.outcome != 'success'",
  'public-non-tai-acl-repair.json',
  "context='TAI PUBLIC Non-TAI ACL Repair'",
  'application deployment performed: \\`false\\`',
  'model mutation performed: \\`false\\`',
  'name: Confirm PUBLIC ACL repair result',
]) requireFragment(workflow, fragment, paths.workflow);

for (const fragment of [
  'ACTION="${1:-}"',
  '[[ "$ACTION" =~ ^(apply|rollback|finalize)$ ]]',
  "readonly ROLE_NAME='tai_runtime'",
  "readonly ENV_FILE='/etc/transparent-price/tai-agro-os.env'",
  'TAI_PUBLIC_ACL_TAI_ENV_PRESENT',
  'TAI_PUBLIC_ACL_TAI_OVERRIDE_PRESENT',
  'TAI_PUBLIC_ACL_TAI_SERVICE_PRESENT',
  'org.opencontainers.image.revision',
  "{'database','dbname','host','hostaddr','port','service','socket','unix_socket'}",
  '[[ "$repository" == postgres || "$repository" == postgresql ]]',
  'TAI_PUBLIC_ACL_DATABASE_RUNTIME_INVALID',
  'rolcanlogin',
  'rolsuper',
  'rolcreatedb',
  'rolcreaterole',
  'rolinherit',
  'rolreplication',
  'rolbypassrls',
  'rolconnlimit',
  "namespace.nspname='public'",
  "relation.relname NOT LIKE 'tai\\\\_%' ESCAPE '\\\\'",
  "has_table_privilege('${ROLE_NAME}',relation.oid,'SELECT')",
  'aclexplode(COALESCE(relation.relacl,ARRAY[]::aclitem[]))',
  'WHERE acl.grantee=0',
  'directRoleAclCount',
  'publicColumnAclCount',
  "if value.get('effectiveRelationCount')!=2 or len(relations)!=2",
  "allowed={'SELECT','REFERENCES'}",
  'public!=effective',
  "entry.get('grantable') is not False",
  "REVOKE {privileges} ON TABLE {target} FROM PUBLIC;",
  "GRANT {privileges} ON TABLE {target} TO PUBLIC;",
  'chmod 0600 "$REVOKE_SQL" "$RESTORE_SQL"',
  'touch "$STATE_ROOT/MUTATION_STARTED"',
  'psql_admin < "$REVOKE_SQL"',
  '[[ "$remaining" == 0 ]]',
  'touch "$STATE_ROOT/APPLIED"',
  'psql_admin < "$RESTORE_SQL"',
  '[[ "$restored" == 2 ]]',
  'touch "$STATE_ROOT/ROLLED_BACK"',
  'touch "$STATE_ROOT/FINALIZED"',
  "'schemaVersion': 'tai.public-non-tai-acl-repair.v1'",
  "'rollbackPrepared': True",
  "'dropOwnedUsed': False",
  "'reassignOwnedUsed': False",
  "'dropRoleUsed': False",
  "'applicationDeploymentPerformed': False",
  "'modelMutationPerformed': False",
  'TAI_PUBLIC_NON_TAI_ACL_APPLY=PASS',
  'TAI_PUBLIC_NON_TAI_ACL_ROLLBACK=PASS',
  'TAI_PUBLIC_NON_TAI_ACL_FINALIZE=PASS',
]) requireFragment(repair, fragment, paths.repair);

forbid(workflow, /pull_request_target:/u, `${paths.workflow}: pull_request_target is forbidden`);
forbid(workflow, /continue-on-error:\s*true\s*\n\s*uses:/mu, `${paths.workflow}: actions may not be silently ignored`);
forbid(workflow, /StrictHostKeyChecking=(?:no|accept-new)/u, `${paths.workflow}: unpinned SSH host acceptance is forbidden`);
forbid(workflow, /runs-on:\s*\[self-hosted/iu, `${paths.workflow}: direct root repair must not run on the restricted self-hosted runner`);
forbid(repair, /\bDROP\s+OWNED\b/iu, `${paths.repair}: DROP OWNED is forbidden`);
forbid(repair, /\bREASSIGN\s+OWNED\b/iu, `${paths.repair}: REASSIGN OWNED is forbidden`);
forbid(repair, /\bDROP\s+ROLE\s+(?:tai_runtime|\$\{ROLE_NAME\})/iu, `${paths.repair}: DROP ROLE is forbidden`);
forbid(repair, /REVOKE\s+ALL\s+PRIVILEGES/iu, `${paths.repair}: broad revoke is forbidden`);
forbid(repair, /\bGRANT\s+(?:INSERT|UPDATE|DELETE|TRUNCATE|TRIGGER|ALL)\b/iu, `${paths.repair}: write or broad PUBLIC restoration is forbidden`);
forbid(repair, /docker\s+compose[^\n]+\b(?:down|up|restart|rm)\b/iu, `${paths.repair}: application deployment mutation is forbidden`);
forbid(repair, /network_mode:\s*host|privileged:\s*true|\/var\/run\/docker[.]sock/iu,
  `${paths.repair}: privileged runtime mutation is forbidden`);
forbid(repair, /\b(?:netlify|vercel|railway|openai[.]com|anthropic[.]com)\b/iu,
  `${paths.repair}: external hosting or paid LLM dependency is forbidden`);
forbid(repair, /set\s+-[^\n]*x/iu, `${paths.repair}: shell tracing is forbidden`);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(`${paths.scope}: invalid schemaVersion`);
if (scope.branch !== 'fix/tai-public-acl-production-repair-20260803') violations.push(`${paths.scope}: branch mismatch`);
if (scope.baselineExactMain !== 'ba06e6067faebab23550db5f54d0f6eeab85550a') violations.push(`${paths.scope}: baseline mismatch`);
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) {
  violations.push(`${paths.scope}: hosting or cost boundary changed`);
}
const expectedPaths = Object.values(paths).sort();
const allowedPaths = Array.isArray(scope.allowedPaths) ? [...scope.allowedPaths].sort() : [];
if (JSON.stringify(expectedPaths) !== JSON.stringify(allowedPaths)) {
  violations.push(`${paths.scope}: allowedPaths must exactly match the governed implementation`);
}

const inventoryIndex = repair.indexOf('> "$INVENTORY_FILE"');
const sqlGenerationIndex = repair.indexOf("<<'PY_VALIDATE_AND_SQL'");
const rollbackPreparedIndex = repair.indexOf('chmod 0600 "$REVOKE_SQL" "$RESTORE_SQL"');
const mutationMarkerIndex = repair.indexOf('touch "$STATE_ROOT/MUTATION_STARTED"');
const revokeIndex = repair.indexOf('psql_admin < "$REVOKE_SQL"', mutationMarkerIndex);
const postconditionIndex = repair.indexOf('[[ "$remaining" == 0 ]]', revokeIndex);
const appliedIndex = repair.indexOf('touch "$STATE_ROOT/APPLIED"', postconditionIndex);
if ([inventoryIndex, sqlGenerationIndex, rollbackPreparedIndex, mutationMarkerIndex, revokeIndex, postconditionIndex, appliedIndex].some(index => index < 0)
  || !(inventoryIndex < sqlGenerationIndex
    && sqlGenerationIndex < rollbackPreparedIndex
    && rollbackPreparedIndex < mutationMarkerIndex
    && mutationMarkerIndex < revokeIndex
    && revokeIndex < postconditionIndex
    && postconditionIndex < appliedIndex)) {
  violations.push(`${paths.repair}: inventory, inverse rollback, mutation, postcondition and applied evidence order is invalid`);
}
const rollbackActionIndex = repair.indexOf('if [[ "$ACTION" == rollback ]]');
const rollbackIndex = repair.indexOf('psql_admin < "$RESTORE_SQL"', rollbackActionIndex);
const rollbackPostcondition = repair.indexOf('[[ "$restored" == 2 ]]', rollbackIndex);
const rollbackMarker = repair.indexOf('touch "$STATE_ROOT/ROLLED_BACK"', rollbackPostcondition);
if ([rollbackActionIndex, rollbackIndex, rollbackPostcondition, rollbackMarker].some(index => index < 0)
  || !(rollbackActionIndex < rollbackIndex && rollbackIndex < rollbackPostcondition && rollbackPostcondition < rollbackMarker)) {
  violations.push(`${paths.repair}: inverse rollback and restoration proof order is invalid`);
}

if (violations.length) {
  console.error('TAI PUBLIC non-TAI ACL repair contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI PUBLIC non-TAI ACL repair contract PASS: exact owner authority, two PUBLIC read-only ACLs, inverse rollback before mutation, RU/EN/ZH plus durable intake acceptance, and no tenant/model/application authority expansion.');
