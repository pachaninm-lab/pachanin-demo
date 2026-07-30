#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const OUTPUT = 'artifacts/pc-crop-10c/acceptance.json';
const PATHS = {
  lock: 'docs/platform-v7/autopilot/project-locks/pc-crop-remainder.json',
  scope: 'docs/platform-v7/autopilot/scopes/pc-crop-10c.json',
  workflow: '.github/workflows/pc-crop-10c.yml',
  schema: 'apps/api/prisma/schema.prisma',
  migration: 'apps/api/prisma/migrations/20260730101500_fgis_grain_tenant_read_authority/migration.sql',
  module: 'apps/api/src/modules/regulatory-integration/regulatory-integration.module.ts',
  dto: 'apps/api/src/modules/regulatory-integration/dto/fgis-grain-tenant-read.dto.ts',
  contract: 'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.contract.ts',
  contractSpec: 'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.contract.spec.ts',
  generated: 'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-1.0.23.operations.generated.ts',
  transport: 'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.transport.ts',
  repository: 'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.repository.ts',
  repositorySpec: 'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.repository.spec.ts',
  controller: 'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.controller.ts',
  controllerSpec: 'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-tenant-read.controller.spec.ts',
  e2e: 'apps/api/test/industrial/fgis-grain-tenant-read.e2e-spec.ts',
  verifier: 'scripts/pc-crop-10c/verify.mjs',
};
const EXPECTED_PATHS = [
  PATHS.workflow,
  PATHS.schema,
  PATHS.migration,
  PATHS.module,
  PATHS.dto,
  PATHS.contract,
  PATHS.contractSpec,
  PATHS.transport,
  PATHS.repository,
  PATHS.repositorySpec,
  PATHS.controller,
  PATHS.controllerSpec,
  PATHS.e2e,
  PATHS.verifier,
  PATHS.scope,
].sort();
const failures = [];

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function json(path) {
  try {
    return JSON.parse(read(path));
  } catch (error) {
    throw new Error(`Invalid JSON ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function check(condition, message, target = failures) {
  if (!condition) target.push(message);
}

function exactArray(actual, expected, label, target = failures) {
  check(
    JSON.stringify([...(actual || [])].sort()) === JSON.stringify([...expected].sort()),
    `${label} mismatch`,
    target,
  );
}

function git(...args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function parseCatalog(source) {
  const match = source.match(/FGIS_GRAIN_1_0_23_BUSINESS_OPERATION_ROWS\s*=\s*(\[.*\])\s+as const satisfies readonly FgisGrainBusinessOperationRow\[\];/su);
  if (!match) throw new Error('Unable to parse generated FGIS Grain operation catalog');
  return JSON.parse(match[1]);
}

function validateProject(lock, scope) {
  check(lock.id === 'PC-CROP-REMAINDER' && lock.status === 'active', 'active PC-CROP lock missing');
  check(lock.activeIssue === 3446, 'project lock is not bound to issue 3446');
  check(lock.activeSlice === 'PC-CROP-10C', 'project lock is not bound to PC-CROP-10C');
  check(lock.productionHosting === 'REG_RU_VPS_ONLY', 'project lock hosting authority changed');
  check(lock.operationalStatus === 'NOT_ATTESTED', 'project lock maturity was elevated');

  check(scope.schemaVersion === 'platform-v7.concurrent-scope.v1', 'scope schema mismatch');
  check(scope.id === 'PC-CROP-10C-3446', 'scope id mismatch');
  check(scope.branch === 'agent/pc-crop-10c-tenant-authorized-read-adapter', 'scope branch mismatch');
  check(scope.projectLockId === lock.id, 'scope project lock binding mismatch');
  check(scope.issue === 3446 && scope.activeSlice === 'PC-CROP-10C', 'scope issue/slice mismatch');
  check(scope.baseCommit === 'bb18f74bb23901b5556944095dfdabb5a2d1a8da', 'scope base commit mismatch');
  check(scope.operationalStatus === 'NOT_ATTESTED', 'scope maturity was elevated');
  check(scope.productionHosting === 'REG_RU_VPS_ONLY', 'scope hosting authority changed');
  exactArray(scope.allowedPaths, EXPECTED_PATHS, 'scope allowed paths');
  check(Object.values(scope.boundaries || {}).every((value) => value === false), 'scope enables a forbidden boundary');
  check(!(scope.allowedPaths || []).some((path) => String(path).includes('**')), 'scope contains wildcard paths');
}

function validateChangedPaths(scope) {
  const base = process.env.BASE_REF;
  if (!base) return [];
  const changed = git('diff', '--name-only', `${base}...HEAD`)
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
    .sort();
  const allowed = new Set(scope.allowedPaths);
  for (const path of changed) check(allowed.has(path), `changed path outside PC-CROP-10C scope: ${path}`);
  return changed;
}

function validateCatalog(catalog, contract) {
  check(catalog.length === 57, `catalog operation count mismatch: ${catalog.length}`);
  const readRows = catalog.filter((row) => row[3] === 'READ');
  const mutationRows = catalog.filter((row) => row[3] === 'MUTATION');
  check(readRows.length === 19, `READ operation count mismatch: ${readRows.length}`);
  check(mutationRows.length === 38, `MUTATION operation count mismatch: ${mutationRows.length}`);
  check(new Set(catalog.map((row) => row[0])).size === catalog.length, 'catalog contains duplicate operation codes');
  check(contract.includes(".filter((row) => row[3] === 'READ')"), 'contract does not derive reads from catalog classification');
  check(contract.includes('MUTATION_OPERATION_FORBIDDEN'), 'contract lacks explicit mutation rejection');
  check(contract.includes('ALL_OPERATION_SET') && contract.includes('READ_OPERATION_SET'), 'contract does not distinguish known mutations from unknown operations');
  check(contract.includes('exactKeys('), 'contract does not reject extra client fields');
  check(contract.includes('INLINE_SECRET_FORBIDDEN'), 'contract lacks inline-secret rejection');
  return { readRows, mutationRows };
}

function validateServerAuthority(dto, controller, repository, migration) {
  for (const field of ['tenantId', 'orgId', 'organizationId', 'role', 'userId', 'mfaVerified']) {
    check(dto.includes(`${field}?: never`), `DTO does not reject client authority field ${field}`);
  }
  check(dto.includes('@IsEmpty({ message: \'tenantId is server-derived\' })'), 'tenant authority rejection is not explicit');
  check(controller.includes('@CurrentUser() user: RequestUser'), 'controller does not consume authenticated server user');
  check(controller.includes("@Roles('ANY_AUTHENTICATED')"), 'controller authentication guard missing');
  check(controller.includes("Cache-Control', 'private, no-store'"), 'controller caching boundary missing');
  check(!controller.includes('@Query(\'tenantId\')') && !controller.includes('@Param(\'tenantId\')'), 'controller accepts client tenant authority');
  check(repository.includes('withTrustedContext('), 'repository does not use trusted RLS context');
  check(
    repository.includes('context.tenantId')
      && repository.includes('context.orgId')
      && migration.includes("current_setting('app.current_user_id', true)")
      && migration.includes("current_setting('app.current_role', true)"),
    'database commands do not persist server-derived authority',
  );
  check(repository.includes('requireMfa('), 'MFA gate missing for authorization management');
  check(repository.includes('PROVIDER_GATES'), 'provider gate authority missing');
  check(repository.includes('independent actors'), 'independent provider attestation enforcement missing');
}

function validateTransport(transport, module, repository) {
  check(transport.includes('readonly available = false'), 'default provider transport is not disabled');
  check(transport.includes('FGIS_GRAIN_READ_TRANSPORT_DISABLED'), 'disabled transport error missing');
  check(!/\bfetch\s*\(|axios|https?\.request|new WebSocket/iu.test(transport), 'default transport contains a network path');
  check(module.includes('useExisting: DisabledFgisGrainTenantReadTransport'), 'module does not bind disabled transport by default');
  check(repository.includes("authorization.status !== 'READ_ONLY_ATTESTED'"), 'execute does not require read attestation');
  check(repository.includes('if (!this.transport.available)'), 'execute does not fail closed on disabled transport');
  check(repository.includes('authorization.allowedOperations.includes(input.operationCode)'), 'tenant operation allow-list is not enforced');
  check(repository.includes('configuration.credentialReference'), 'transport receives credential reference metadata');
  check(!repository.includes('credentialBytes') && !repository.includes('privateKeyBytes'), 'repository handles inline credential material');
}

function validatePostgres(schema, migration, repository) {
  for (const model of [
    'model FgisGrainTenantReadAuthorization',
    'model FgisGrainTenantReadProviderClaim',
    'model FgisGrainTenantReadAudit',
    'model FgisGrainTenantReadAuditHead',
  ]) {
    check(schema.includes(model), `Prisma schema missing ${model}`);
  }
  for (const table of ['fgis_grain_tenant_read_authorizations', 'fgis_grain_tenant_read_audits']) {
    check(migration.includes(`CREATE TABLE public."${table}"`), `migration missing ${table}`);
    check(migration.includes(`ALTER TABLE public."${table}" FORCE ROW LEVEL SECURITY`), `forced RLS missing for ${table}`);
  }
  check(migration.includes('current_setting(\'app.current_tenant_id\', true)'), 'tenant RLS setting missing');
  check(migration.includes('current_setting(\'app.current_org_id\', true)'), 'organization RLS setting missing');
  check(migration.includes('reject_fgis_grain_tenant_read_audit_mutation'), 'immutable audit trigger missing');
  check(migration.includes('guard_fgis_grain_tenant_read_claim_update'), 'immutable provider-claim facts guard missing');
  check(migration.includes('UNIQUE ("tenantId", "organizationId", "idempotencyKey")'), 'durable idempotency constraint missing');
  check(migration.includes('UNIQUE ("tenantId", "organizationId", "chainSequence")'), 'monotonic audit sequence constraint missing');
  check(migration.includes('fgis_grain_tenant_read_audit_heads'), 'tenant audit-chain head table missing');
  check(
    schema.includes('tenantReadTransportAdmittedVersion BigInt?')
      && migration.includes('ADD COLUMN "tenantReadTransportAdmittedVersion" bigint')
      && migration.includes('tenant-read transport admission is missing'),
    'database-owned disabled-by-default version-bound transport admission is missing',
  );
  check(migration.includes('"authorizationVersion" bigint NOT NULL'), 'audit is not bound to the authorization version');
  check(migration.includes('"requestIdempotencyKey" text NOT NULL'), 'audit lacks request-level idempotency binding');
  check(migration.includes("'IN_FLIGHT'"), 'durable single-flight claim state missing');
  check(
    migration.includes('GRANT SELECT ON TABLE public."fgis_grain_tenant_read_authorizations"')
      && migration.includes('GRANT SELECT ON TABLE public."fgis_grain_tenant_read_audits"'),
    'runtime tables are not read-only',
  );
  check(
    !migration.includes('GRANT SELECT, INSERT, UPDATE ON TABLE public."fgis_grain_tenant_read_authorizations"')
      && !migration.includes('GRANT SELECT, INSERT ON TABLE public."fgis_grain_tenant_read_audits"'),
    'runtime keeps a direct authorization or audit DML bypass',
  );
  check(!migration.includes('GRANT DELETE') && !migration.includes('GRANT ALL'), 'migration grants unsafe mutation authority');
  check(!migration.includes('grainflow_runtime'), 'migration targets a nonexistent runtime principal');
  check(migration.includes("ARRAY['app_runtime', 'app_service']"), 'runtime principal grant set mismatch');
  check(migration.includes('public.app_rls_context_ready()'), 'role-aware RLS context guard missing');
  check(migration.includes('auth.sessions') && migration.includes('membership."role"'), 'database command context is not bound to persistent session role');
  check(migration.includes('mfa_verified_at') && migration.includes('mfa_level'), 'database command context is not bound to MFA');
  check(migration.includes('write_fgis_grain_tenant_read_authorization'), 'controlled authorization command missing');
  check(migration.includes('attest_fgis_grain_tenant_read_authorization'), 'controlled attestation command missing');
  check(migration.includes('append_fgis_grain_tenant_read_audit'), 'controlled audit command missing');
  check(migration.includes('finalize_fgis_grain_tenant_read_claim'), 'claim-bound terminal command missing');
  check(migration.includes('fgis_grain_tenant_read_auth_select_policy'), 'authorization SELECT policy missing');
  check(migration.includes('fgis_grain_tenant_read_auth_insert_policy'), 'authorization INSERT policy missing');
  check(migration.includes('fgis_grain_tenant_read_auth_update_policy'), 'authorization UPDATE policy missing');
  check(migration.includes('text_array_has_unique_elements'), 'database duplicate-operation guard missing');
  check(migration.includes('FOR UPDATE'), 'database audit-chain serialization missing');
  check(
    migration.includes('PRIMARY KEY ("tenantId", "organizationId")')
      && migration.includes('"lastSequence" = next_sequence')
      && !migration.includes('ORDER BY audit."createdAt"'),
    'audit chain head is not a locked tenant and organization sequence',
  );
  check(
    migration.includes('computed_hash := encode(public.digest')
      && migration.includes('computed_hash,')
      && migration.includes('current_head')
      && migration.includes("'chainSequence', next_sequence::text")
      && migration.includes("'providerClaimId', p_provider_claim_id")
      && migration.includes("'createdAt', to_char(")
      && migration.includes('HH24:MI:SS.US')
      && !migration.includes('p_hash text')
      && !migration.includes('p_prev_hash text'),
    'complete-precision audit hash and predecessor are not database-computed',
  );
  const authorizationCommand = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION public.write_fgis_grain_tenant_read_authorization'),
    migration.indexOf('CREATE OR REPLACE FUNCTION public.attest_fgis_grain_tenant_read_authorization'),
  );
  const attestationCommand = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION public.attest_fgis_grain_tenant_read_authorization'),
    migration.indexOf('CREATE OR REPLACE FUNCTION public.append_fgis_grain_tenant_read_audit(\n'),
  );
  check(
    authorizationCommand.includes('append_fgis_grain_tenant_read_audit_internal')
      && attestationCommand.includes('append_fgis_grain_tenant_read_audit_internal')
      && !repository.includes("decision: 'AUTHORIZED'")
      && !repository.includes("decision: 'ATTESTED'"),
    'authorization or attestation state can commit without its database-owned audit',
  );
  check(
    attestationCommand.includes('"tenantReadTransportAdmittedVersion"')
      && attestationCommand.includes('= current_row."configurationVersion"')
      && migration.includes('REVOKE INSERT, UPDATE, DELETE ON TABLE public."fgis_grain_provider_configurations"'),
    'direct database attestation can bypass version-bound transport admission',
  );
  const finalizer = migration.slice(
    migration.indexOf('CREATE OR REPLACE FUNCTION public.finalize_fgis_grain_tenant_read_claim'),
    migration.indexOf('CREATE OR REPLACE FUNCTION public.reject_fgis_grain_tenant_read_audit_mutation'),
  );
  check(
    finalizer.includes('fgis_grain_tenant_read_provider_claims')
      && finalizer.includes('claim."actorUserId"')
      && finalizer.includes('claim."authorizationVersion"')
      && finalizer.includes('"completionTokenSha256"')
      && finalizer.includes("p_reason_code <> 'PROVIDER_READ_SUCCEEDED'")
      && finalizer.includes("p_reason_code <> 'PROVIDER_READ_FAILED'")
      && finalizer.includes('FOR UPDATE')
      && finalizer.includes('claim."completedAuditId" IS NOT NULL')
      && !finalizer.includes('fgis_grain_tenant_read_context_ready')
      && !finalizer.includes("current_setting('app.current_"),
    'terminal provider outcome is not capability- and claim-bound independently of session state',
  );
  check(repository.includes('lockIdempotency('), 'request-level single-flight lock missing');
  check(repository.includes("decision: 'IN_FLIGHT'"), 'repository does not durably claim provider execution');
  check(repository.includes('completionToken'), 'repository does not retain an opaque claim completion capability');
  check(repository.includes('finalize_fgis_grain_tenant_read_claim'), 'repository bypasses claim-bound finalization');
  check(repository.includes('authorizationVersion !== BigInt(input.authorizationVersion)'), 'replay is not bound to the current authorization version');
  check(repository.includes('Prisma.join(input.allowedOperations)'), 'PostgreSQL operation array binding is not parameterized safely');
  check(repository.includes('if (preflight.denial)'), 'denied request audit can roll back with the HTTP rejection');
}

function validateWorkflowEvidence(workflow) {
  check(!workflow.includes('set -o pipefail'), 'workflow contains a fail-open shell pipeline');
  for (const marker of [
    'migration.ok',
    'api-typecheck.ok',
    'unit-tests.ok',
    'postgresql-acceptance.ok',
  ]) {
    const markerIndex = workflow.indexOf(marker);
    const runIndex = workflow.lastIndexOf('run: |', markerIndex);
    check(markerIndex >= 0, `workflow evidence marker missing: ${marker}`);
    check(
      runIndex >= 0
        && workflow.slice(runIndex, markerIndex).includes('set -euo pipefail'),
      `workflow evidence marker can be written after a failed command: ${marker}`,
    );
  }
}

function validateTests(contractSpec, repositorySpec, controllerSpec, e2e) {
  check(contractSpec.includes('toHaveLength(19)'), 'contract test does not pin nineteen reads');
  check(contractSpec.includes('MUTATION_OPERATION_FORBIDDEN'), 'contract test does not prove mutation denial');
  check(repositorySpec.includes('not.toHaveBeenCalled()'), 'repository test does not prove pre-DB rejection');
  check(repositorySpec.includes('DisabledFgisGrainTenantReadTransport'), 'repository test does not prove disabled default transport');
  check(controllerSpec.includes('If-Match') && controllerSpec.includes('BadRequestException'), 'controller test does not prove optimistic concurrency input');
  check(e2e.includes("PC_CROP_10C_POSTGRESQL === '1'"), 'PostgreSQL E2E activation flag missing');
  check(e2e.includes('cross-tenant') || e2e.includes('BUYER_B'), 'PostgreSQL E2E does not prove cross-tenant denial');
  check(e2e.includes('READ_ONLY_ATTESTED'), 'PostgreSQL E2E does not prove attested read state');
  check(e2e.includes('replayed: true'), 'PostgreSQL E2E does not prove durable replay');
  check(e2e.includes('immutable'), 'PostgreSQL E2E does not prove audit immutability');
  check(e2e.includes('CREATE_SDIZ'), 'PostgreSQL E2E does not prove provider mutation rejection');
  check(e2e.includes('runtimeVisibleAuthorizationCount'), 'PostgreSQL E2E does not use the restricted runtime principal');
  check(e2e.includes('AUTHORIZATION_NOT_ATTESTED'), 'PostgreSQL E2E does not prove committed denial evidence');
  check(e2e.includes('FGIS_GRAIN_READ_IN_FLIGHT'), 'PostgreSQL E2E does not prove single-flight admission');
  check(e2e.includes('transport.available = false'), 'PostgreSQL E2E does not reject replay while transport is disabled');
  check(e2e.includes('forged direct runtime transition'), 'PostgreSQL E2E does not prove direct runtime DML denial');
  check(e2e.includes('audit hash chains tenant and organization scoped'), 'PostgreSQL E2E does not prove tenant-scoped audit chaining');
  check(e2e.includes('records the claimed provider outcome after concurrent reauthorization'), 'PostgreSQL E2E does not prove claim-bound terminal outcome');
  check(e2e.includes('session revocation, and role drift'), 'PostgreSQL E2E does not prove session-independent claim finalization');
  check(e2e.includes('forged-completion-capability'), 'PostgreSQL E2E does not reject a forged claim completion capability');
  check(e2e.includes('FORGED_PROVIDER_READ_SUCCEEDED'), 'PostgreSQL E2E does not reject forged runtime outcome facts');
  check(e2e.includes('computes every immutable audit hash inside PostgreSQL'), 'PostgreSQL E2E does not prove database-owned audit hashing');
  check(e2e.includes('inseparable from database-owned audits'), 'PostgreSQL E2E does not prove atomic authorization and attestation audits');
  check(e2e.includes('fgis_grain_tenant_read_audit_heads'), 'PostgreSQL E2E does not prove monotonic chain-head state');
  check(e2e.includes('rejects direct database attestation while transport admission is absent'), 'PostgreSQL E2E does not prove database transport admission');
  check(e2e.includes('serializes competing direct terminal outcomes for one opaque provider claim'), 'PostgreSQL E2E does not prove terminal outcome serialization');
}

function validateTruthBoundary(scope, repository, transport) {
  const combined = `${JSON.stringify(scope)}\n${repository}\n${transport}`;
  check(combined.includes('NOT_ATTESTED'), 'NOT_ATTESTED truth boundary missing');
  check(!/CONFIRMED_LIVE|PRODUCTION_ATTESTED|platformReadEnabled\s*[:=]\s*true/iu.test(combined), 'unproven live claim introduced');
  check(scope.boundaries?.providerWriteAllowed === false, 'provider write boundary weakened');
  check(scope.boundaries?.externalLiveClaimAllowed === false, 'external live-claim boundary weakened');
}

const lock = json(PATHS.lock);
const scope = json(PATHS.scope);
const generated = read(PATHS.generated);
const catalog = parseCatalog(generated);
const contract = read(PATHS.contract);
const dto = read(PATHS.dto);
const transport = read(PATHS.transport);
const repository = read(PATHS.repository);
const controller = read(PATHS.controller);
const workflow = read(PATHS.workflow);
const schema = read(PATHS.schema);
const migration = read(PATHS.migration);
const module = read(PATHS.module);
const contractSpec = read(PATHS.contractSpec);
const repositorySpec = read(PATHS.repositorySpec);
const controllerSpec = read(PATHS.controllerSpec);
const e2e = read(PATHS.e2e);

validateProject(lock, scope);
const changedPaths = validateChangedPaths(scope);
const { readRows, mutationRows } = validateCatalog(catalog, contract);
validateServerAuthority(dto, controller, repository, migration);
validateTransport(transport, module, repository);
validatePostgres(schema, migration, repository);
validateWorkflowEvidence(workflow);
validateTests(contractSpec, repositorySpec, controllerSpec, e2e);
validateTruthBoundary(scope, repository, transport);

for (const path of EXPECTED_PATHS) check(fs.existsSync(path), `required path missing: ${path}`);
const forbiddenMaterial = [contract, dto, transport, repository, controller, migration].join('\n');
check(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._-]{16,}|AKIA[A-Z0-9]{16}/u.test(forbiddenMaterial), 'secret material detected');

const report = {
  schemaVersion: 'pc-crop-10c.acceptance.v1',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  exactHead: git('rev-parse', 'HEAD'),
  issue: 3446,
  slice: 'PC-CROP-10C',
  projectLockId: 'PC-CROP-REMAINDER',
  operationalStatus: 'NOT_ATTESTED',
  productionHosting: 'REG_RU_VPS_ONLY',
  counts: {
    catalogOperations: catalog.length,
    readOperations: readRows.length,
    mutationOperationsRejected: mutationRows.length,
    allowedPaths: EXPECTED_PATHS.length,
    changedPaths: changedPaths.length,
  },
  boundaries: {
    providerWriteAllowed: false,
    clientSelectedAuthorityAllowed: false,
    inlineSecretsAllowed: false,
    externalLiveClaimAllowed: false,
    transportEnabledByDefault: false,
    runtimeDeployment: false,
  },
  failures,
};
fs.mkdirSync('artifacts/pc-crop-10c', { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
