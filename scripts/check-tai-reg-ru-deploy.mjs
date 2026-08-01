#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workflowPath = '.github/workflows/tai-reg-ru-deploy.yml';
const deployPath = 'scripts/tai-reg-ru-deploy.sh';
const preflightPath = 'scripts/tai-reg-ru-preflight.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/tai-postgres-authority-20260801.json';
const checkerPath = 'scripts/check-tai-reg-ru-deploy.mjs';
const workflow = readFileSync(workflowPath, 'utf8');
const deploy = readFileSync(deployPath, 'utf8');
const preflight = readFileSync(preflightPath, 'utf8');
const checker = readFileSync(checkerPath, 'utf8');
const scope = JSON.parse(readFileSync(scopePath, 'utf8'));
const violations = [];
const requireFragment = (source, fragment, label) => {
  if (!source.includes(fragment)) violations.push(label + ': missing ' + JSON.stringify(fragment));
};
const forbid = (source, pattern, label) => {
  if (pattern.test(source)) violations.push(label);
};

for (const fragment of [
  'workflows: ["TAI Restricted Qwen REG.RU Activation"]',
  "inputs.confirmation == 'DEPLOY-TAI-REG-RU'",
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  '[[ "$TARGET_SHA" == "$(git rev-parse origin/main)" ]]',
  'runs-on: [self-hosted, linux, x64, pc-prod, tai-readonly]',
  'Verify canonical exact-SHA rootless TAI image outside production',
  'Verify direct production authority is absent',
  'sudo -n /usr/local/sbin/pc-tai-release-controller deploy',
  'Upload exact-main deployment evidence',
  "context='TAI REG.RU Deployment'",
]) requireFragment(workflow, fragment, workflowPath);

for (const fragment of [
  'TAI_IMAGE_DIGEST',
  'image: ${TAI_IMAGE_DIGEST}',
  'docker pull "$TAI_IMAGE_DIGEST"',
  'remote_digest_match=',
  '"$(docker inspect --format \'{{.Image}}\' "$tai_id")" = "$expected_image_id"',
  '"$(docker inspect --format \'{{.Config.Image}}\' "$tai_id")" = "$TAI_IMAGE_DIGEST"',
  'COMPOSE_JSON="$(mktemp)"',
  'CONTAINERS_JSON="$(mktemp)"',
  'PY_POSTGRES_AUTHORITY',
  'database_url = api_env.get("DATABASE_URL", "")',
  'database_url != database_url.strip()',
  'r"%(?![0-9A-Fa-f]{2})"',
  'parsed.scheme not in {"postgres", "postgresql"}',
  'database_port = parsed.port',
  'parsed.netloc.count("@") > 1',
  'parse_qsl(',
  'DATABASE_URL_AUTHORITY_OVERRIDE_FORBIDDEN',
  'database_host not in services',
  'POSTGRES_HELPER_SERVICE_FORBIDDEN',
  'POSTGRES_PERSISTENT_AUTHORITY_AMBIGUOUS',
  'POSTGRES_RUNNING_CONTAINER_AUTHORITY_AMBIGUOUS',
  'POSTGRES_DB_MISMATCH',
  'STATE_ROOT_CREATED_THIS_ATTEMPT=0',
  'elif (( STATE_ROOT_CREATED_THIS_ATTEMPT == 1 )); then',
  'mkdir -- "$STATE_ROOT" || { echo "STATE_ROOT_ALREADY_EXISTS_OR_UNAVAILABLE"',
  'STATE_ROOT_CREATED_THIS_ATTEMPT=1',
  'compose_has_durable_storage',
  'container_has_durable_storage',
  'persistent_postgres != [database_host]',
  'labels(api).get("org.opencontainers.image.revision") != target_sha',
  '--filter "label=com.docker.compose.project=$prod_project"',
  'test "$(env_value_from_container "$DB_ID" POSTGRES_DB)" = "$DB_NAME"',
  "--filter 'label=com.docker.compose.service=tai'",
  'PREVIOUS_TAI_ROLLBACK_AUTHORITY_INCOMPLETE',
  'user: "65532:65532"',
  'read_only: true',
  'cap_drop:',
  '- ALL',
  'no-new-privileges:true',
  'NOBYPASSRLS',
  'NOSUPERUSER',
  'NOCREATEDB',
  'NOCREATEROLE',
  'NOINHERIT',
  'NOREPLICATION',
  'rolinherit',
  'has_table_privilege',
  "relation.relname NOT LIKE 'tai\\\\_%' ESCAPE '\\\\'",
  'nonTaiTableGrantCount',
  'membershipCount',
  'docker port "$tai_id"',
  'TAI_MODEL_BEARER_TOKEN=${model_token}',
  'HMACPlatformIdentityAuthority',
  'canonical_api_request_sha256',
  'preparedActionCount',
  'toolExecution',
  'TAI_REG_RU_DEPLOY_ROLLBACK=PASS',
  'TAI_REG_RU_DEPLOYMENT_COMPLETE=1',
  'tai.reg-ru.deployment.v1',
  'newRecurringCostRub',
  'MODEL_EVIDENCE_FILE',
  'tai_schema_migrations',
  'tai.production-bootstrap-authority.v1',
  'TAI_RESTRICTED_MODEL_OPERATIONAL=true',
  'permanentModelAdmissionStatus',
  'FORWARD_ONLY_IDEMPOTENT',
  'tai-agro-os-master-spec-v4.0',
]) requireFragment(deploy, fragment, deployPath);

for (const fragment of [
  'TAI_SERVICE_NOT_MATERIALIZED',
  'TAI_DEDICATED_ENV_NOT_MATERIALIZED',
  'TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED',
  'NO_PRODUCTION_MUTATION_DETECTED',
  'compose.tai-agro-os.override.yml',
  'TAI_OVERRIDE_PROTECTED',
  'expected_image_id=',
  'has_table_privilege',
]) requireFragment(preflight, fragment, preflightPath);

forbid(workflow, /PC_PROD_SSH_|PROD_HOST_SECRET|PROD_KEY_|PROD_HOST_FINGERPRINT|id_pc_prod|prod_known_hosts|\bscp\b/u, workflowPath + ': production SSH transport is forbidden');
forbid(workflow, /continue-on-error:\s*true/mu, workflowPath + ': continue-on-error is forbidden');
forbid(deploy, /set\s+-[^\n]*x/iu, deployPath + ': shell tracing is forbidden');
forbid(deploy, /^\s*ports\s*:/mu, deployPath + ': public or host port publication is forbidden');
forbid(deploy, /network_mode:\s*host|privileged:\s*true|^\s*cap_add\s*:|\/var\/run\/docker[.]sock/imu, deployPath + ': privileged TAI container configuration is forbidden');
forbid(deploy, /TAI_PLATFORM_TOOL_(?:BASE_URL|HMAC_SECRET)/u, deployPath + ': platform tools must remain disabled-safe');
forbid(deploy, /\b(?:netlify|vercel|railway|openai[.]com|anthropic[.]com)\b/iu, deployPath + ': external hosting or cloud LLM dependency is forbidden');
forbid(deploy, /GRANT\s+ALL\b|GRANT[^\n]+ON\s+ALL\s+TABLES/iu, deployPath + ': broad database grant is forbidden');
forbid(deploy, /docker\s+compose[^\n]+\bdown\b/iu, deployPath + ': full Compose shutdown is forbidden');
forbid(deploy, /(?:AI_ASSISTANT_API_KEY|TAI_MODEL_BEARER_TOKEN)[^\n]*(?:echo|printf)/iu, deployPath + ': model credential output is forbidden');
forbid(deploy, /["']postgres["']\s+in\s+image[.]lower[(][)]/u, deployPath + ': broad PostgreSQL image substring selector is forbidden');
forbid(deploy, /INSERT\s+INTO\s+(?:public[.])?tai_model_admission_decisions/iu, deployPath + ': fabricated permanent model admission is forbidden');

for (const fragment of [
  "set -Eeuo pipefail",
  "PRODUCTION_MUTATION_STARTED",
  "mutationStarted: existsSync(mutationPath)",
  "result.mutationStarted",
]) requireFragment(checker, fragment, checkerPath);

const resolverMarker = "<<'PY_POSTGRES_AUTHORITY'\n";
const resolverStart = deploy.indexOf(resolverMarker);
const resolverBodyStart = resolverStart < 0 ? -1 : resolverStart + resolverMarker.length;
const resolverEnd = resolverBodyStart < 0 ? -1 : deploy.indexOf('\nPY_POSTGRES_AUTHORITY', resolverBodyStart);
if (resolverStart < 0 || resolverBodyStart < 0 || resolverEnd < 0) {
  violations.push(deployPath + ': embedded PostgreSQL authority resolver is missing');
}
const resolverSource = resolverBodyStart >= 0 && resolverEnd >= 0
  ? deploy.slice(resolverBodyStart, resolverEnd)
  : '';
const authoritySlice = resolverEnd >= 0
  ? deploy.slice(resolverEnd, deploy.indexOf('\napply_tai_migrations\n', resolverEnd))
  : '';
if (/\bps\s+-q\s+(?:api|"\$DB_SERVICE")[^\n]*head\s+-1/u.test(authoritySlice)) {
  violations.push(deployPath + ': API or database authority may not use head -1');
}
const mutationCalls = [
  '\nmkdir -- "$STATE_ROOT"',
  '\nmkdir -p /etc/transparent-price\n',
  '\nchmod 0700 "$STATE_ROOT" /etc/transparent-price\n',
  '\napply_tai_migrations\n',
  '\nbuild_bootstrap_authority\n',
  '\napply_bootstrap_authority\n',
  '\nMUTATION_STARTED=1\n',
];
for (const call of mutationCalls) {
  const index = deploy.indexOf(call, resolverEnd);
  if (resolverEnd < 0 || index <= resolverEnd) {
    violations.push(deployPath + ': production mutation precedes PostgreSQL authority for ' + JSON.stringify(call.trim()));
  }
}
if (/else\s*\n\s*rm -rf\s+(?:--\s+)?["']?\$STATE_ROOT/um.test(deploy)) {
  violations.push(deployPath + ': pre-authority failure may remove a pre-existing state root');
}
const resolverInvocationLine = deploy.split(/\r?\n/u).find((line) => line.includes("<<'PY_POSTGRES_AUTHORITY'")) || '';
if (resolverInvocationLine.includes('|| true') || resolverInvocationLine.includes('continue-on-error')) {
  violations.push(deployPath + ': PostgreSQL authority failure is masked');
}

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') violations.push(scopePath + ': invalid schemaVersion');
if (scope.branch !== 'fix/tai-postgres-service-authority-20260801') violations.push(scopePath + ': branch mismatch');
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) violations.push(scopePath + ': hosting or cost boundary changed');
if (scope.productionMutationAllowedBeforeMerge !== false) violations.push(scopePath + ': pre-merge mutation boundary changed');
const authorityPaths = [deployPath, checkerPath, scopePath].sort();
const allowedPaths = Array.isArray(scope.allowedPaths) ? [...scope.allowedPaths].sort() : [];
if (JSON.stringify(authorityPaths) !== JSON.stringify(allowedPaths)) violations.push(scopePath + ': authority allowedPaths mismatch');

const TARGET_SHA = '0'.repeat(40);
const PROJECT = 'transparent_price';
const API_ID = 'a'.repeat(64);
const DB_ID = 'b'.repeat(64);
const DB_ID_2 = 'c'.repeat(64);
const API_ID_2 = 'd'.repeat(64);
let negativeFixtureExecutions = 0;

function durableComposeService(image = 'postgres:16') {
  return {
    image,
    environment: { POSTGRES_DB: 'platform', POSTGRES_USER: 'postgres' },
    volumes: [{ type: 'volume', source: 'postgres-data', target: '/var/lib/postgresql/data' }],
  };
}

function container(id, service, image, env, mounts = []) {
  return {
    Id: id,
    State: { Status: 'running' },
    Config: {
      Image: image,
      Env: env,
      Labels: {
        'com.docker.compose.project': PROJECT,
        'com.docker.compose.service': service,
        'org.opencontainers.image.revision': service === 'api' ? TARGET_SHA : '',
      },
    },
    Mounts: mounts,
  };
}

function authorityFixture() {
  return {
    compose: {
      services: {
        api: { image: 'ghcr.io/pachaninm-lab/grainflow-api:sha-0000000' },
        postgres: durableComposeService(),
        provision: {
          image: 'postgres:16',
          environment: { POSTGRES_DB: 'platform', POSTGRES_USER: 'postgres' },
        },
      },
    },
    containers: [
      container(API_ID, 'api', 'ghcr.io/pachaninm-lab/grainflow-api:sha-0000000', [
        'DATABASE_URL=postgresql://app:secret@postgres:5432/platform?schema=public',
      ]),
      container(DB_ID, 'postgres', 'postgres:16', [
        'POSTGRES_DB=platform',
        'POSTGRES_USER=postgres',
      ], [{ Type: 'volume', Name: 'postgres-data', Destination: '/var/lib/postgresql/data' }]),
    ],
  };
}

function runAuthorityFixture(fixture) {
  const root = mkdtempSync(join(tmpdir(), 'tai-postgres-authority-'));
  const composePath = join(root, 'compose.json');
  const containersPath = join(root, 'containers.json');
  const outputPath = join(root, 'authority.env');
  const mutationPath = join(root, 'production-mutation.started');
  try {
    writeFileSync(composePath, JSON.stringify(fixture.compose));
    writeFileSync(containersPath, JSON.stringify(fixture.containers));
    const shellHarness = [
      'set -Eeuo pipefail',
      'python3 - "$1" "$2" "$3" "$4" "$5" <<\'PY_POSTGRES_AUTHORITY\'',
      resolverSource,
      'PY_POSTGRES_AUTHORITY',
      "printf '%s\\n' 'PRODUCTION_MUTATION_STARTED' > \"$6\"",
      '',
    ].join('\n');
    const result = spawnSync(
      'bash',
      ['-s', '--', composePath, containersPath, outputPath, TARGET_SHA, PROJECT, mutationPath],
      { input: shellHarness, encoding: 'utf8', timeout: 10_000 },
    );
    return {
      status: result.status,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      wroteAuthority: existsSync(outputPath),
      mutationStarted: existsSync(mutationPath),
      output: result.status === 0 ? readFileSync(outputPath, 'utf8') : '',
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function expectPass(name, mutate, expectedFragment) {
  const fixture = authorityFixture();
  mutate(fixture);
  const result = runAuthorityFixture(fixture);
  if (result.status !== 0 || !result.mutationStarted || !result.output.includes(expectedFragment)) {
    violations.push(name + ': expected PASS and mutation spy, got status=' + result.status
      + ' mutationStarted=' + result.mutationStarted + ' stderr=' + result.stderr.trim());
  }
}

function expectFail(name, mutate, expectedCode) {
  negativeFixtureExecutions += 1;
  const fixture = authorityFixture();
  mutate(fixture);
  const result = runAuthorityFixture(fixture);
  if (result.status === 0 || result.wroteAuthority || result.mutationStarted || !result.stderr.includes(expectedCode)) {
    violations.push(name + ': expected ' + expectedCode + ' before mutation, got status=' + result.status
      + ' wroteAuthority=' + result.wroteAuthority + ' mutationStarted=' + result.mutationStarted
      + ' stderr=' + result.stderr.trim());
  }
}

if (resolverSource) {
  expectPass('postgres plus provision selects only postgres', () => {}, 'DB_SERVICE=postgres');
  for (const scenario of [
    {
      name: 'missing running exact-main API container fails',
      code: 'API_CONTAINER_AUTHORITY_AMBIGUOUS',
      mutate(fixture) {
        fixture.containers = fixture.containers.filter((item) => item.Config.Labels['com.docker.compose.service'] !== 'api');
      },
    },
    {
      name: 'two running exact-main API containers fail',
      code: 'API_CONTAINER_AUTHORITY_AMBIGUOUS',
      mutate(fixture) {
        fixture.containers.push(container(
          API_ID_2,
          'api',
          'ghcr.io/pachaninm-lab/grainflow-api:sha-0000000',
          ['DATABASE_URL=postgresql://app:secret@postgres:5432/platform'],
        ));
      },
    },
    {
      name: 'non-exact-main API container fails',
      code: 'API_EXACT_MAIN_MISMATCH',
      mutate(fixture) {
        fixture.containers[0].Config.Labels['org.opencontainers.image.revision'] = '1'.repeat(40);
      },
    },
    {
      name: 'duplicate API DATABASE_URL authority fails',
      code: 'API_ENVIRONMENT_AMBIGUOUS',
      mutate(fixture) {
        fixture.containers[0].Config.Env.push('DATABASE_URL=postgresql://app:other@postgres:5432/platform');
      },
    },
  ]) {
    expectFail(scenario.name, scenario.mutate, scenario.code);
  }
  expectFail('two persistent PostgreSQL services fail', (fixture) => {
    fixture.compose.services.analytics = durableComposeService('registry.local/postgres:16');
  }, 'POSTGRES_PERSISTENT_AUTHORITY_AMBIGUOUS');
  expectFail('DATABASE_URL host absent from Compose fails', (fixture) => {
    fixture.containers[0].Config.Env = ['DATABASE_URL=postgresql://app:secret@missing:5432/platform'];
  }, 'DATABASE_HOST_SERVICE_MISSING');
  expectFail('DATABASE_URL host pointing to non-PostgreSQL fails', (fixture) => {
    fixture.compose.services.mysql = durableComposeService('mysql:8');
    fixture.containers[0].Config.Env = ['DATABASE_URL=postgresql://app:secret@mysql:5432/platform'];
  }, 'POSTGRES_SERVICE_IMAGE_INVALID');
  expectFail('unsupported DATABASE_URL scheme fails', (fixture) => {
    fixture.containers[0].Config.Env = ['DATABASE_URL=mysql://app:secret@postgres:5432/platform'];
  }, 'DATABASE_URL_SCHEME_INVALID');
  expectFail('malformed DATABASE_URL port fails', (fixture) => {
    fixture.containers[0].Config.Env = ['DATABASE_URL=postgresql://app:secret@postgres:notaport/platform'];
  }, 'DATABASE_URL_INVALID');
  expectFail('malformed DATABASE_URL userinfo fails', (fixture) => {
    fixture.containers[0].Config.Env = ['DATABASE_URL=postgresql://app:secret@@postgres:5432/platform'];
  }, 'DATABASE_URL_INVALID');
  expectFail('malformed DATABASE_URL password escape fails', (fixture) => {
    fixture.containers[0].Config.Env = ['DATABASE_URL=postgresql://app:%ZZ@postgres:5432/platform'];
  }, 'DATABASE_URL_INVALID');
  expectFail('malformed DATABASE_URL query escape fails', (fixture) => {
    fixture.containers[0].Config.Env = ['DATABASE_URL=postgresql://app:secret@postgres:5432/platform?schema=%ZZ'];
  }, 'DATABASE_URL_INVALID');
  expectFail('DATABASE_URL query host override fails', (fixture) => {
    fixture.containers[0].Config.Env = ['DATABASE_URL=postgresql://app:secret@postgres:5432/platform?host=provision'];
  }, 'DATABASE_URL_AUTHORITY_OVERRIDE_FORBIDDEN');
  expectFail('percent-encoded DATABASE_URL query host override fails', (fixture) => {
    fixture.containers[0].Config.Env = ['DATABASE_URL=postgresql://app:secret@postgres:5432/platform?h%6fst=provision'];
  }, 'DATABASE_URL_AUTHORITY_OVERRIDE_FORBIDDEN');
  expectFail('duplicate DATABASE_URL query parameter fails', (fixture) => {
    fixture.containers[0].Config.Env = ['DATABASE_URL=postgresql://app:secret@postgres:5432/platform?schema=public&schema=private'];
  }, 'DATABASE_URL_QUERY_INVALID');
  expectFail('empty DATABASE_URL fails', (fixture) => {
    fixture.containers[0].Config.Env = ['DATABASE_URL='];
  }, 'DATABASE_URL_MISSING');
  expectFail('missing running PostgreSQL container fails', (fixture) => {
    fixture.containers = [fixture.containers[0]];
  }, 'POSTGRES_RUNNING_CONTAINER_AUTHORITY_AMBIGUOUS');
  expectFail('two running authority containers fail', (fixture) => {
    fixture.containers.push(container(DB_ID_2, 'postgres', 'postgres:16', [
      'POSTGRES_DB=platform',
      'POSTGRES_USER=postgres',
    ], [{ Type: 'volume', Name: 'postgres-data-2', Destination: '/var/lib/postgresql/data' }]));
  }, 'POSTGRES_RUNNING_CONTAINER_AUTHORITY_AMBIGUOUS');
  expectFail('POSTGRES_DB mismatch fails', (fixture) => {
    fixture.containers[1].Config.Env = ['POSTGRES_DB=other', 'POSTGRES_USER=postgres'];
  }, 'POSTGRES_DB_MISMATCH');
  for (const helper of ['provision', 'provision2', 'init', 'migration', 'seed', 'backup', 'restore']) {
    expectFail('helper service ' + helper + ' cannot become authority', (fixture) => {
      fixture.compose.services[helper] = durableComposeService();
      fixture.containers[0].Config.Env = [
        'DATABASE_URL=postgresql://app:secret@' + helper + ':5432/platform',
      ];
    }, 'POSTGRES_HELPER_SERVICE_FORBIDDEN');
  }
  expectFail('running PostgreSQL container without durable storage fails', (fixture) => {
    fixture.containers[1].Mounts = [];
  }, 'POSTGRES_RUNNING_STORAGE_INVALID');
  expectFail('ephemeral PostgreSQL service cannot become authority', (fixture) => {
    fixture.compose.services.postgres.volumes = [];
  }, 'POSTGRES_SERVICE_STORAGE_INVALID');
}

const requiredNegativeFixtureCount = scope.acceptance?.negativeFixtureCount;
if (!Number.isInteger(requiredNegativeFixtureCount) || negativeFixtureExecutions !== requiredNegativeFixtureCount) {
  violations.push(scopePath + ': executable negative fixture count differs from the declared count: '
    + negativeFixtureExecutions + ' != ' + requiredNegativeFixtureCount);
}

if (violations.length) {
  console.error('TAI REG.RU deployment contract failed:');
  for (const violation of violations) console.error('- ' + violation);
  process.exit(1);
}
console.log('TAI REG.RU deployment contract PASS: DATABASE_URL-bound exact-main PostgreSQL authority, '
  + negativeFixtureExecutions + ' executable pre-mutation-spied negative fixtures, protected controller, rollback and zero cost.');
