import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-auth-mail-api-principal-acl-repair-v2-3785.yml';
const scriptPath = 'scripts/production-p0-auth-mail-api-principal-acl-repair-v2-3785.sh';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');

const workflowRequired = [
  "github.event.issue.number == 3072",
  "github.event.comment.author_association == 'OWNER'",
  "github.event.comment.body == '/production p0-auth-mail-api-principal-acl-repair-v2 31986790721 current-main'",
  "TRUSTED_CONNECTOR_APP_ID: '1144995'",
  "PRODUCTION_MUTATION_ALLOWED: 'true'",
  "PC_IS_PRODUCTION: 'true'",
  'persist-credentials: false',
];
for (const marker of workflowRequired) {
  if (!workflow.includes(marker)) throw new Error(`workflow missing: ${marker}`);
}

const scriptRequired = [
  "COMMAND='/production p0-auth-mail-api-principal-acl-repair-v2 31986790721 current-main'",
  "EXPECTED_OWNER='pc_auth_mail_enqueue_authority'",
  "REMOTE_STAGE='API_IDENTITY'",
  "REMOTE_STAGE='MIGRATION_AUTHORITY'",
  "LOCAL_STAGE='MIGRATION_IMAGE_PROVENANCE'",
  "REMOTE_STAGE='API_IDENTITY_REBIND'",
  "REMOTE_STAGE='AUTHORITY_INSPECT'",
  "REMOTE_STAGE='GRANT_EXACT'",
  'mutation_attempted=1',
  'GRANT USAGE ON SCHEMA auth TO ${qi(role)}',
  'GRANT EXECUTE ON FUNCTION ${functionSig} TO ${qi(role)}',
  'REVOKE EXECUTE ON FUNCTION ${functionSig} FROM ${qi(role)}',
  'REVOKE USAGE ON SCHEMA auth FROM ${qi(role)}',
  "REMOTE_STAGE='API_POSTVERIFY'",
  "REMOTE_STAGE='RUNTIME_INVARIANTS'",
  "AUTH_MAIL_API_PRINCIPAL_ACL_REPAIR_V2=PASS",
  'PASSWORD_RESET|NONE',
  'MAIL_SEND|NONE',
  'API_WEB_RESTART|NONE',
];
for (const marker of scriptRequired) {
  if (!script.includes(marker)) throw new Error(`script missing: ${marker}`);
}

if (script.includes("has_function_privilege(current_user,\n        'auth.enqueue_mail_outbox") && script.indexOf("REMOTE_STAGE='API_IDENTITY'") < script.indexOf("LOCAL_STAGE='MIGRATION_IMAGE_PROVENANCE'")) {
  throw new Error('pre-grant API identity stage must not resolve auth function');
}

const apiIdentityStart = script.indexOf("REMOTE_STAGE='API_IDENTITY'");
const migrationAuthorityStart = script.indexOf("REMOTE_STAGE='MIGRATION_AUTHORITY'");
if (apiIdentityStart < 0 || migrationAuthorityStart <= apiIdentityStart) throw new Error('stage order invalid');
const apiIdentitySurface = script.slice(apiIdentityStart, migrationAuthorityStart);
for (const forbidden of ['has_schema_privilege', 'has_function_privilege', 'has_table_privilege', 'auth.mail_outbox', 'auth.enqueue_mail_outbox']) {
  if (apiIdentitySurface.includes(forbidden)) throw new Error(`API identity stage resolves auth object before grant: ${forbidden}`);
}
if (!apiIdentitySurface.includes('current_user::text AS effective_role') || !apiIdentitySurface.includes('session_user::text AS session_role')) {
  throw new Error('API identity binding missing');
}
if (!apiIdentitySurface.includes('x.effective_role !== x.session_role')) throw new Error('effective/session equality guard missing');
if (!apiIdentitySurface.includes('rolsuper') || !apiIdentitySurface.includes('rolbypassrls') || !apiIdentitySurface.includes('rolcreaterole')) {
  throw new Error('privileged-role guard missing');
}

const grantLines = script.split(/\r?\n/).filter((line) => line.includes('await tx.$executeRawUnsafe(`GRANT'));
if (grantLines.length !== 2) throw new Error(`expected exactly 2 executable GRANT statements, got ${grantLines.length}`);
if (!grantLines.some((line) => line.includes('GRANT USAGE ON SCHEMA auth TO ${qi(role)}'))) throw new Error('schema grant missing');
if (!grantLines.some((line) => line.includes('GRANT EXECUTE ON FUNCTION ${functionSig} TO ${qi(role)}'))) throw new Error('function grant missing');
for (const line of grantLines) {
  if (/GRANT\s+ALL|\bPUBLIC\b|\b(SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)\b/i.test(line)) {
    throw new Error(`broad grant forbidden: ${line}`);
  }
}

const operationalForbidden = [
  /ALTER\s+ROLE/i,
  /CREATE\s+ROLE/i,
  /DROP\s+ROLE/i,
  /ALTER\s+TABLE/i,
  /CREATE\s+TABLE/i,
  /DROP\s+TABLE/i,
  /prisma\s+migrate\s+deploy/i,
  /docker\s+(restart|kill|rm)\b/i,
  /docker\s+compose\s+(up|down|restart)\b/i,
  /set\s+-x/,
];
const operationalLines = script.split(/\r?\n/).filter((line) =>
  /ALTER\s+ROLE|CREATE\s+ROLE|DROP\s+ROLE|ALTER\s+TABLE|CREATE\s+TABLE|DROP\s+TABLE|prisma\s+migrate\s+deploy|docker\s+(restart|kill|rm)|docker\s+compose\s+(up|down|restart)|set\s+-x/i.test(line)
).join('\n');
for (const pattern of operationalForbidden) {
  if (pattern.test(operationalLines)) throw new Error(`forbidden operational mutation: ${pattern}`);
}

if (!script.includes("public_execute) throw new Error('function-authority')")) throw new Error('PUBLIC EXECUTE fail-closed guard missing');
if (!script.includes("if(before.table) throw new Error('table-privilege')")) throw new Error('table privilege fail-closed guard missing');
if (!script.includes("ACL_ATTEMPTED_ROLLBACK_%s")) throw new Error('uncertain-mutation rollback marker missing');
if (!script.includes("git merge-base --is-ancestor \"$migration_revision\" \"$CURRENT_MAIN\"")) throw new Error('migration image ancestry guard missing');
if (!script.includes('[[ "$current_blob" == "$image_blob" ]]')) throw new Error('migration bytes provenance guard missing');

console.log('production auth-mail API principal ACL repair v2 contract: PASS');
