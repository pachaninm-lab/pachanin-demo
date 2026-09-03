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
  'WATCHTOWER_RUNNING',
  'ROLE_ELIGIBILITY_ENFORCEMENT_UNCHANGED',
  'REGISTRATION_CONFIGURATION_UNCHANGED',
  'PROTECTED_CONTAINERS_UNCHANGED',
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
  'scripts/check-role-eligibility-registration-guard.mjs',
  'infra/docker/Dockerfile.api',
  'GIT_COMMIT=${{ steps.target.outputs.sha }}',
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
];
for (const pattern of forbiddenExecutor) {
  if (pattern.test(source.executor)) failures.push(`${files.executor} violates blast-radius rule: ${pattern}`);
}

const forbiddenWorkflow = [
  /\/production release current-main/,
  /production-full-stack-exact-sha/i,
  /ROLE_ELIGIBILITY_ENFORCEMENT=true/,
  /issue\.number == (?:3072|4637)/,
];
for (const pattern of forbiddenWorkflow) {
  if (pattern.test(source.workflow)) failures.push(`${files.workflow} violates authority boundary: ${pattern}`);
}

if (!/docker pull \"\$API_IMAGE\"/.test(source.executor)) failures.push('executor must pull only the exact API image');
if (!/services:\n  api:\n    image: \$image\n    pull_policy: never/.test(source.executor)) failures.push('executor override must contain only api image authority');
if (!/trap 'cleanup_on_exit/.test(source.executor)) failures.push('executor must arm exit rollback');
if (!/MUTATION_STARTED=1\nwrite_override/.test(source.executor)) failures.push('rollback must be armed before persistent override mutation');

if (failures.length) {
  failures.forEach((failure) => console.error(`ROLE_ELIGIBILITY_API_RELEASE_CONTRACT_ERROR=${failure}`));
  process.exit(1);
}

console.log('ROLE_ELIGIBILITY_API_RELEASE_CONTRACT=PASS');
console.log('REGISTRATION_CODE_CHANGED=0');
console.log('ROLE_ELIGIBILITY_ENFORCEMENT=false');
console.log('UNRELATED_PRODUCTION_SERVICE_MUTATION=0');
