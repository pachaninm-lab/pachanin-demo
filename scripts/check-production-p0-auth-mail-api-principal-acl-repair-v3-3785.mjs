import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-auth-mail-api-principal-acl-repair-v3-3785.yml';
const scriptPath = 'scripts/production-p0-auth-mail-api-principal-acl-repair-v3-3785.sh';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');

const workflowRequired = [
  "github.event.issue.number == 3072",
  "github.event.comment.author_association == 'OWNER'",
  "github.event.comment.body == '/production p0-auth-mail-api-principal-acl-repair-v3 31990014692 current-main'",
  "TRUSTED_CONNECTOR_APP_ID: '1144995'",
  "PRODUCTION_MUTATION_ALLOWED: 'true'",
  "PC_IS_PRODUCTION: 'true'",
  'persist-credentials: false',
];
for (const marker of workflowRequired) {
  if (!workflow.includes(marker)) throw new Error(`workflow missing: ${marker}`);
}

const required = [
  "COMMAND='/production p0-auth-mail-api-principal-acl-repair-v3 31990014692 current-main'",
  "MIGRATION_NAME='20260812010000_p0_industrial_auth_mail_outbox'",
  "REGPROC='auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)'",
  "EXPECTED_OWNER='pc_auth_mail_enqueue_authority'",
  "EXPECTED_SEARCH_PATH='search_path=pg_catalog, auth, pg_temp'",
  "EXPECTED_ROW_SECURITY='row_security=on'",
  "LOCAL_STAGE='SAFE_INVENTORY'",
  "LOCAL_STAGE='MIGRATION_IMAGE_PROVENANCE'",
  'git merge-base --is-ancestor "$migration_revision" "$CURRENT_MAIN"',
  '[[ "$current_blob" == "$image_blob" ]]',
  "REMOTE_STAGE='API_IDENTITY_REBIND'",
  "REMOTE_STAGE='AUTHORITY_PREFLIGHT'",
  "REMOTE_STAGE='GRANT_EXACT'",
  "REMOTE_STAGE='DB_POSTVERIFY'",
  "REMOTE_STAGE='API_POSTVERIFY'",
  'rolinherit',
  'relrowsecurity AND relforcerowsecurity',
  "cfg='$expected_search_path'",
  "cfg='$expected_row_security'",
  "a.grantee=0 AND a.privilege_type='EXECUTE'",
  'mutation_attempted=1',
  'ACL_ATTEMPTED_ROLLBACK_${rollback_state}',
  "[[ \"$pre_schema|$pre_exec\" == 'NO|NO' || \"$pre_schema|$pre_exec\" == 'YES|YES' ]]",
  "EXECUTE format('GRANT USAGE ON SCHEMA auth TO %I',r)",
  "EXECUTE format('GRANT EXECUTE ON FUNCTION $regproc TO %I',r)",
  "EXECUTE format('REVOKE EXECUTE ON FUNCTION $regproc FROM %I',r)",
  "EXECUTE format('REVOKE USAGE ON SCHEMA auth FROM %I',r)",
  'TABLE_PRIVILEGES_NONE',
  'PUBLIC_TABLE_NONE',
  'PRODUCTION_DB_MUTATION',
  'PASSWORD_RESET=NONE',
  'MAIL_SEND=NONE',
  'API_WEB_RESTART=NONE',
];
for (const marker of required) {
  if (!script.includes(marker)) throw new Error(`script missing: ${marker}`);
}

const exactOnce = [
  "EXECUTE format('GRANT USAGE ON SCHEMA auth TO %I',r)",
  "EXECUTE format('GRANT EXECUTE ON FUNCTION $regproc TO %I',r)",
  "EXECUTE format('REVOKE EXECUTE ON FUNCTION $regproc FROM %I',r)",
  "EXECUTE format('REVOKE USAGE ON SCHEMA auth FROM %I',r)",
];
for (const marker of exactOnce) {
  const count = script.split(marker).length - 1;
  if (count !== 1) throw new Error(`expected exactly one bounded ACL statement: ${marker}; got ${count}`);
}

if (script.indexOf('mutation_attempted=1') > script.indexOf('  apply_acl\n')) {
  throw new Error('mutation attempt marker must precede apply call');
}

const forbidden = [
  /GRANT\s+ALL\b/i,
  /GRANT\s+(SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)\b/i,
  /GRANT\s+[^\n;]*\bON\s+(TABLE\s+)?auth\.mail_outbox\b/i,
  /\bALTER\s+(ROLE|TABLE|FUNCTION)\b/i,
  /\bCREATE\s+(ROLE|TABLE|FUNCTION)\b/i,
  /\bDROP\s+(ROLE|TABLE|FUNCTION)\b/i,
  /prisma\s+migrate\s+deploy/i,
  /docker\s+(restart|kill|rm)\b/i,
  /docker\s+compose\s+(up|down|restart)\b/i,
  /set\s+-x/,
];
const executable = script.split(/\r?\n/).filter((line) => {
  const t = line.trim();
  if (t.startsWith('grep -Fq ')) return false;
  if (t.startsWith('#')) return false;
  return true;
}).join('\n');
for (const pattern of forbidden) {
  if (pattern.test(executable)) throw new Error(`forbidden operational surface: ${pattern}`);
}

if (!script.includes("raw DB role / role token / role digest / DB URL / credentials / SQL errors / PII")) {
  throw new Error('redaction contract missing');
}
if (!script.includes("node_modules/prisma/build/index.js db execute --stdin --schema prisma/schema.prisma")) {
  throw new Error('Prisma CLI authority missing');
}

console.log('production auth-mail API principal ACL repair v3 contract: PASS');
