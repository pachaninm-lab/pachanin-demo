#!/usr/bin/env node
import fs from 'node:fs';

const migrationPath = 'apps/api/prisma/migrations/20260822143000_p0_authenticated_totp_compatibility/migration.sql';
const repositoryPath = 'apps/api/src/modules/auth/persistent-auth.repository.ts';
const repositorySpecPath = 'apps/api/src/modules/auth/persistent-auth.repository.spec.ts';
const principalSpecPath = 'apps/api/src/common/prisma/auth-principal-provisioning.spec.ts';
const integrationPath = 'scripts/platform-v7-rls-integration.sh';
const drPath = 'scripts/platform-v7-database-dr-rehearsal.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/authenticated-totp-owner-readiness-3785.json';
const checkerPath = 'scripts/check-authenticated-totp-owner-readiness.mjs';

const migration = fs.readFileSync(migrationPath, 'utf8');
const repository = fs.readFileSync(repositoryPath, 'utf8');
const repositorySpec = fs.readFileSync(repositorySpecPath, 'utf8');
const principalSpec = fs.readFileSync(principalSpecPath, 'utf8');
const integration = fs.readFileSync(integrationPath, 'utf8');
const dr = fs.readFileSync(drPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

const branch = 'fix/authenticated-totp-owner-readiness-3785';
const authorityBase = '1df1e55d4596c0bfe1ffa957f4d821bdcb26b5cb';
const allowedPaths = [
  migrationPath,
  principalSpecPath,
  repositorySpecPath,
  repositoryPath,
  scopePath,
  checkerPath,
  drPath,
  integrationPath,
];

function fail(message) {
  throw new Error(`AUTHENTICATED_TOTP_OWNER_READINESS:${message}`);
}

function requireAll(label, source, needles) {
  for (const needle of needles) {
    if (!source.includes(needle)) fail(`${label} missing ${needle}`);
  }
}

function rejectAll(label, source, patterns) {
  for (const pattern of patterns) {
    if (typeof pattern === 'string' ? source.includes(pattern) : pattern.test(source)) {
      fail(`${label} contains forbidden ${String(pattern)}`);
    }
  }
}

requireAll('repository', repository, [
  'AND session_id = ${input.sessionId}',
  'AND user_id = ${input.userId}',
  'mfa_key_version = CASE',
  "WHEN ${input.method === 'TOTP'}",
  "~ '^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'",
  "if (input.method === 'TOTP')",
  'auth.finalize_authenticated_user_mfa(',
  "throw new Error('MFA user state conflict')",
]);
rejectAll('repository', repository, [
  /if \(input\.method === 'BACKUP'\)[\s\S]{0,500}finalize_authenticated_user_mfa/,
  'mfa_secret_ciphertext = CASE',
]);

requireAll('migration', migration, [
  'CREATE OR REPLACE FUNCTION auth.finalize_authenticated_user_mfa(',
  'RETURNS TABLE (updated boolean)',
  'SECURITY DEFINER',
  'SET search_path = pg_catalog, pg_temp',
  'SET row_security = on',
  'UPDATE public."users" subject',
  'SET "mfaEnabled" = true',
  "challenge.\"type\" IN ('TOTP_ENROLL', 'TOTP_VERIFY')",
  "challenge.\"status\" = 'VERIFIED'",
  'challenge.verified_at = pg_catalog.transaction_timestamp()',
  'challenge.expires_at > pg_catalog.transaction_timestamp()',
  "session.\"status\" = 'ACTIVE'",
  'session.revoked_at IS NULL',
  'session.expires_at > pg_catalog.transaction_timestamp()',
  "session.mfa_level = 'TOTP'",
  "session.mfa_verified_method = 'TOTP'",
  'session.mfa_verified_at = pg_catalog.transaction_timestamp()',
  'challenge.verified_at = session.mfa_verified_at',
  'session.credential_version = credential.credential_version',
  'credential.credential_version > 0',
  'credential.mfa_enabled = true',
  "credential.mfa_key_version = 'v1'",
  "credential.mfa_secret_ciphertext\n         ~ '^v1:",
  'GET DIAGNOSTICS affected = ROW_COUNT',
  'ALTER FUNCTION auth.finalize_authenticated_user_mfa(text, text, text)',
  'OWNER TO pc_auth_mfa_authority',
  'REVOKE ALL ON FUNCTION auth.finalize_authenticated_user_mfa(text, text, text)',
  'FROM PUBLIC',
  'pg_catalog.aclexplode(',
  'privilege.grantee = 0',
  "privilege.privilege_type = 'EXECUTE'",
]);
rejectAll('migration', migration, [
  'CREATE ROLE',
  'GRANT EXECUTE',
  /\b(?:INSERT|DELETE|TRUNCATE|MERGE)\s+(?:INTO\s+|FROM\s+)?auth\./i,
  /UPDATE\s+auth\./i,
  /UPDATE\s+public\."users"[\s\S]*WHERE\s+subject\."id"\s+IS\s+NOT\s+NULL/i,
]);

const bodyMatch = migration.match(
  /AS \$function\$\n([\s\S]*?)\n\$function\$;/,
);
if (!bodyMatch) fail('migration function body is not statically extractable');
const functionBody = bodyMatch[1];
if ((functionBody.match(/\bUPDATE\b/gi) || []).length !== 1) {
  fail('finalizer must contain exactly one UPDATE');
}
if (/\b(?:INSERT|DELETE|TRUNCATE|MERGE|CALL|EXECUTE)\b/i.test(functionBody)) {
  fail('finalizer contains a forbidden write or dynamic execution statement');
}

requireAll('repository tests', repositorySpec, [
  'session_id =',
  'user_id =',
  'mfa_key_version = CASE',
  'never lets a backup-code login reconcile',
  'fails the transaction when a fresh TOTP cannot prove',
  "method: 'TOTP', enableMfa: false",
  "method: 'BACKUP', enableMfa: false",
]);
requireAll('principal tests', principalSpec, [
  'reconciles the compatibility MFA flag only from a fresh bound TOTP proof',
  migrationPath,
  'challenge.verified_at = pg_catalog.transaction_timestamp()',
  "session.mfa_verified_method = 'TOTP'",
  'expect(migration).not.toMatch(/CREATE ROLE|GRANT EXECUTE/)',
]);

requireAll('DR rehearsal', dr, [
  "p.prosrc LIKE '%challenge.\"type\" IN (''TOTP_ENROLL'', ''TOTP_VERIFY'')%'",
  "p.prosrc LIKE '%challenge.verified_at = pg_catalog.transaction_timestamp()%'",
  "p.prosrc LIKE '%session.mfa_verified_method = ''TOTP''%'",
  "p.prosrc LIKE '%session.mfa_verified_at = pg_catalog.transaction_timestamp()%'",
  "p.prosrc LIKE '%challenge.verified_at = session.mfa_verified_at%'",
  "p.prosrc LIKE '%session.credential_version = credential.credential_version%'",
  'RESTORE_MFA_AUTHORITY_PROOF=',
]);

requireAll('integration', integration, [
  'P0_AUTHENTICATED_TOTP_COMPATIBILITY_MIGRATION=',
  '== authenticated TOTP compatibility: pc_auth_runtime ==',
  'auth.finalize_authenticated_user_mfa',
  'PASS  M1 fresh same-transaction TOTP_VERIFY changes only users.mfaEnabled false -> true',
  'PASS  M7 a credential-version mismatch returns false without flag mutation',
  'ROLLBACK;',
]);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') fail('scope schema mismatch');
if (scope.branch !== branch || scope.status !== 'active') fail('scope branch/status mismatch');
if (scope.issue !== 3785 || scope.releaseIssue !== 3072) fail('scope authority mismatch');
if (scope.authorityBaseExactMain !== authorityBase) fail('scope exact-main mismatch');
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) {
  fail('scope hosting/cost mismatch');
}
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify([...allowedPaths].sort())) {
  fail('scope allowed paths mismatch');
}
const boundaries = scope.boundaries || {};
for (const key of [
  'registrationOnly', 'reviewerOwnerAccessOnly', 'freshTotpRequired',
  'sameTransactionProofRequired', 'backupCodeCannotReconcile',
]) {
  if (boundaries[key] !== true) fail(`scope boundary must be true: ${key}`);
}
for (const key of [
  'passwordResetOrRecovery', 'mfaSecretReplacement', 'broadDataBackfill',
  'newRoleOrGrant', 'roleOrTenantMutation', 'pullRequestProductionMutation',
  'deploymentAuthorized', 'dnsMutation', 'sshPinMutation', 'credentialOutput',
]) {
  if (boundaries[key] !== false) fail(`scope boundary must be false: ${key}`);
}
if (boundaries.newRecurringCostRub !== 0) fail('scope recurring cost mismatch');

console.log('authenticated TOTP owner-readiness contract PASS');
