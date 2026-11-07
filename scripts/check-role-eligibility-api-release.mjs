import fs from 'node:fs';

const files = {
  executor: 'scripts/production-role-eligibility-api-release.sh',
  workflow: '.github/workflows/role-eligibility-production-api-release.yml',
};

const source = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, fs.readFileSync(path, 'utf8')]));
const failures = [];

function requireAll(key, markers) {
  for (const marker of markers) {
    if (!source[key].includes(marker)) failures.push(`${files[key]} missing: ${marker}`);
  }
}

requireAll('executor', [
  'ghcr.io/pachaninm-lab/grainflow-api:sha-',
  'org.opencontainers.image.revision',
  'compose.role-eligibility-api-image.override.yml',
  'up -d --no-deps --force-recreate --pull never api',
  'ROLE_ELIGIBILITY_API_ROLLBACK_ATTEMPTED',
  'ROLE_ELIGIBILITY_API_ROLLBACK_COMPLETED',
  'API_RUNTIME_CONFIGURATION_CHANGED',
  'PROTECTED_CONTAINER_SET_CHANGED',
  'BASELINE_PROTECTED_SNAPSHOT_INVALID',
  'PROTECTED_SNAPSHOT_INVALID',
  'label=com.docker.compose.project=$prod_project',
  'runtime_fingerprint "$id"',
  "excluded=\"$(docker inspect --format '{{.Id}}' \"$excluded\" 2>/dev/null || true)\"",
  'WATCHTOWER_RUNNING',
  'ROLE_ELIGIBILITY_ENFORCEMENT_UNCHANGED',
  'REGISTRATION_CONFIGURATION_UNCHANGED',
  'PROTECTED_CONTAINERS_UNCHANGED',
  'API_DIGEST="${PC_ROLE_ELIGIBILITY_API_DIGEST:-}"',
  '[[ "$API_DIGEST" =~ ^ghcr\\.io/pachaninm-lab/grainflow-api@sha256:[0-9a-f]{64}$ ]] || fail API_DIGEST_REFERENCE_INVALID 7',
  '[[ -n "$API_DIGEST" ]] || return 0',
  'docker pull "$API_DIGEST" >/dev/null || fail API_DIGEST_PULL_FAILED 40',
  'PINNED_API_IMAGE_ID="$(docker image inspect --format \'{{.Id}}\' "$API_DIGEST" 2>/dev/null || true)"',
  '[[ "$PINNED_API_IMAGE_ID" =~ ^sha256:[0-9a-f]{64}$ ]] || fail API_DIGEST_IMAGE_ID_INVALID 41',
  '[[ "$pinned_revision" == "$TARGET_SHA" ]] || fail API_DIGEST_REVISION_MISMATCH 42',
  '[[ "$actual_id" == "$PINNED_API_IMAGE_ID" ]] || fail API_IMAGE_DIGEST_MISMATCH 43',
  '[[ -z "$API_DIGEST" || "$baseline_image_id" == "$PINNED_API_IMAGE_ID" ]] || fail API_AUDIT_DIGEST_MISMATCH 45',
  '[[ -z "$API_DIGEST" || "$new_image_id" == "$PINNED_API_IMAGE_ID" ]] || fail DEPLOYED_API_DIGEST_MISMATCH 44',
  '[[ -z "$API_DIGEST" ]] || emit ROLE_ELIGIBILITY_API_DIGEST_VERIFIED PASS',
  'W1_ROUTES="${PC_ROLE_ELIGIBILITY_W1_ROUTES:-0}"',
  '[[ "$W1_ROUTES" == 0 || "$W1_ROUTES" == 1 ]] || fail W1_ROUTE_MODE_INVALID 46',
  '[[ "$ACTION" == deploy && -n "$API_DIGEST" ]] || fail W1_ROUTE_DIGEST_REQUIRED 47',
  '[[ -f "$w1_checker" && ! -L "$w1_checker" ]] || fail W1_ROUTE_SOURCE_MISSING 48',
  'w1_route_boundary "$new_api_id"',
  '|| fail W1_API_ROUTE_BOUNDARY_FAILED 49',
  '|| fail W1_API_ROUTE_EVIDENCE_INVALID 50',
]);

requireAll('workflow', [
  'READINESS_ISSUE_NUMBER: 4922',
  'COMMAND: /role-eligibility api deploy current-main',
  "github.event.issue.number == 4922",
  "github.event.comment.user.login == github.repository_owner",
  "github.event.comment.author_association == 'OWNER'",
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  'ROLE_ELIGIBILITY_API_RELEASE_MAIN_DRIFT',
  'ROLE_ELIGIBILITY_API_TARGET_SHA_INVALID',
  'scripts/check-role-eligibility-registration-guard.mjs',
  'infra/docker/Dockerfile.api',
  'GIT_COMMIT=${{ steps.target.outputs.sha }}',
  'ref: ${{ github.sha }}',
  'TARGET_SHA: ${{ github.sha }}',
  'PC_ROLE_ELIGIBILITY_API_IMAGE=',
  'ROLE_ELIGIBILITY_API_RELEASE=PASS',
  'REGISTRATION_CONFIGURATION_UNCHANGED=PASS',
  'PROTECTED_CONTAINERS_UNCHANGED=PASS',
]);

const forbiddenExecutor = [
  /docker\s+(?:stop|rm|restart)\b/,
  /docker\s+compose[^\n]*(?:\bweb\b|\bmigration\b)/,
  /\bprisma\b/i,
  /ROLE_ELIGIBILITY_ENFORCEMENT=true/,
  /docker ps -q --no-trunc \| awk -v excluded=/,
];
for (const pattern of forbiddenExecutor) {
  if (pattern.test(source.executor)) failures.push(`${files.executor} violates blast-radius rule: ${pattern}`);
}

const forbiddenWorkflow = [
  /\/production release current-main/,
  /production-full-stack-exact-sha/i,
  /ROLE_ELIGIBILITY_ENFORCEMENT=true/,
  /issue\.number == (?:3072|4637)/,
  /needs\.build\.outputs\.target_sha/,
];
for (const pattern of forbiddenWorkflow) {
  if (pattern.test(source.workflow)) failures.push(`${files.workflow} violates authority boundary: ${pattern}`);
}

if ((source.workflow.match(/TARGET_SHA: \$\{\{ github\.sha \}\}/g) || []).length < 3) {
  failures.push('workflow must bind every deploy-stage target SHA directly to the immutable issue-comment github.sha');
}
if (!/\[\[ \"\$TARGET_SHA\" =~ \^\[0-9a-f\]\{40\}\$ \]\] \|\| \{ echo ROLE_ELIGIBILITY_API_TARGET_SHA_INVALID >&2; exit 29; \}/.test(source.workflow)) {
  failures.push('deploy must reject an invalid or empty TARGET_SHA before current-main comparison');
}
if (!/docker pull \"\$API_IMAGE\"/.test(source.executor)) failures.push('executor must pull only the exact API image');
if (!/services:\n  api:\n    image: \$image\n    pull_policy: never/.test(source.executor)) failures.push('executor override must contain only api image authority');
if (!/trap 'cleanup_on_exit/.test(source.executor)) failures.push('executor must arm exit rollback');
const routeProbe=source.executor.indexOf('\nw1_route_boundary "$new_api_id"\n');
if (!(routeProbe>source.executor.indexOf("trap 'cleanup_on_exit")
  && routeProbe>source.executor.indexOf('|| fail DEPLOYED_API_REVISION_MISMATCH 36')
  && routeProbe<source.executor.lastIndexOf('emit ROLE_ELIGIBILITY_API_RELEASE PASS'))) {
  failures.push('W1 route probe must fail inside the armed rollback boundary before release acceptance');
}
if (!source.executor.includes("$'PC_W1_API_ROUTE_BOUNDARY=PASS\\nPC_W1_API_ROUTES=5\\nPC_W1_AUTHENTICATED_ACCEPTANCE=NOT_EVIDENCED'")) {
  failures.push('W1 route probe must require complete exact evidence without business acceptance');
}
if (!/MUTATION_STARTED=1\nwrite_override/.test(source.executor)) failures.push('rollback must be armed before persistent override mutation');
const tagPull = source.executor.indexOf('docker pull "$API_IMAGE"');
const firstDigestCheck = source.executor.indexOf('\nassert_api_image_digest\n');
const rollbackDefinition = source.executor.indexOf('\ncleanup_on_exit(){');
if (!(tagPull >= 0 && firstDigestCheck > tagPull && firstDigestCheck < rollbackDefinition)) {
  failures.push('optional digest must be checked after the legacy tag pull, before any mutation');
}
if (!source.executor.includes('assert_api_image_digest\nMUTATION_STARTED=1\nwrite_override')) {
  failures.push('optional digest must be rechecked immediately before persistent override mutation');
}
if (!source.executor.includes('assert_api_image_digest\n"${dc_target[@]}" up -d --no-deps --force-recreate --pull never api')) {
  failures.push('optional digest must be rechecked immediately before API recreation');
}
if (!source.executor.includes('new_image_id="$(docker inspect --format \'{{.Image}}\' "$new_api_id")"\n[[ -z "$API_DIGEST" || "$new_image_id" == "$PINNED_API_IMAGE_ID" ]]')) {
  failures.push('running API image must match the pinned digest after readiness');
}
const auditBranch = source.executor.slice(source.executor.indexOf('if [[ "$ACTION" == audit ]]'), tagPull);
if (!(auditBranch.indexOf('API_AUDIT_DIGEST_MISMATCH') >= 0
  && auditBranch.indexOf('API_AUDIT_DIGEST_MISMATCH') < auditBranch.indexOf('emit ROLE_ELIGIBILITY_API_RELEASE PASS'))) {
  failures.push('audit must validate the supplied digest before reporting acceptance');
}
if (!/docker ps -q --no-trunc --filter \"label=com\.docker\.compose\.project=\$prod_project\"/.test(source.executor)) {
  failures.push('protected snapshot must be scoped to the canonical production Compose project');
}
if (!/printf '%s\\t%s\\t%s\\t%s\\t%s\\n' \"\$service\" \"\$name\" \"\$image_ref\" \"\$image_id\" \"\$fingerprint\"/.test(source.executor)) {
  failures.push('protected snapshot must use stable semantic identity instead of container IDs');
}
if (!/excluded=\"\$\(docker inspect --format '\{\{\.Id\}\}' \"\$excluded\" 2>\/dev\/null \|\| true\)\"/.test(source.executor)) {
  failures.push('protected snapshot must normalize the excluded API container to full Docker identity');
}

if (failures.length) {
  failures.forEach((failure) => console.error(`ROLE_ELIGIBILITY_API_RELEASE_CONTRACT_ERROR=${failure}`));
  process.exit(1);
}

console.log('ROLE_ELIGIBILITY_API_RELEASE_CONTRACT=PASS');
console.log('REGISTRATION_CODE_CHANGED=0');
console.log('ROLE_ELIGIBILITY_ENFORCEMENT=false');
console.log('UNRELATED_PRODUCTION_SERVICE_MUTATION=0');
