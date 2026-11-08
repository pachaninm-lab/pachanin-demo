import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-auth-mail-api-principal-acl-repair-3785.yml';
const scriptPath = 'scripts/production-p0-auth-mail-api-principal-acl-repair-3785.sh';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');

const requiredWorkflow = [
  "github.event.issue.number == 3072",
  "github.event.comment.body == '/production p0-auth-mail-api-principal-acl-repair 31985916787 current-main'",
  "github.event.comment.author_association == 'OWNER'",
  "TRUSTED_CONNECTOR_APP_ID: '1144995'",
  "PRODUCTION_MUTATION_ALLOWED: 'true'",
  "PC_IS_PRODUCTION: 'true'",
  'persist-credentials: false',
];
for (const marker of requiredWorkflow) {
  if (!workflow.includes(marker)) throw new Error(`workflow missing required marker: ${marker}`);
}

const requiredScript = [
  "COMMAND='/production p0-auth-mail-api-principal-acl-repair 31985916787 current-main'",
  "FUNCTION_SIG='auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz)'",
  "EXPECTED_OWNER='pc_auth_mail_enqueue_authority'",
  'GRANT USAGE ON SCHEMA auth TO ${qi(role)}',
  'GRANT EXECUTE ON FUNCTION ${functionSig} TO ${qi(role)}',
  'REVOKE EXECUTE ON FUNCTION ${functionSig} FROM ${qi(role)}',
  'REVOKE USAGE ON SCHEMA auth FROM ${qi(role)}',
  "process.stdout.write('APPLY|PASS\\n')",
  "process.stdout.write('ROLLBACK|PASS\\n')",
  "VERIFY|${x.s?'YES':'NO'}|${x.f?'YES':'NO'}|${tableAny?'TABLE_PRESENT':'TABLE_NONE'}",
  'API_WEB_RESTART=NONE',
  'PASSWORD_RESET=NONE',
  'MAIL_SEND=NONE',
];
for (const marker of requiredScript) {
  if (!script.includes(marker)) throw new Error(`script missing required marker: ${marker}`);
}

const sqlGrantLines = script.split(/\r?\n/).filter((line) => line.includes('GRANT ') && line.includes('await tx.$executeRawUnsafe'));
if (sqlGrantLines.length !== 2) throw new Error(`expected exactly 2 executable GRANT lines, got ${sqlGrantLines.length}`);
if (!sqlGrantLines.some((line) => line.includes('GRANT USAGE ON SCHEMA auth TO ${qi(role)}'))) throw new Error('missing exact schema USAGE grant');
if (!sqlGrantLines.some((line) => line.includes('GRANT EXECUTE ON FUNCTION ${functionSig} TO ${qi(role)}'))) throw new Error('missing exact function EXECUTE grant');

const operationalForbidden = [
  /GRANT\s+ALL/i,
  /GRANT\s+(SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)\b/i,
  /GRANT[^\n]*ON\s+(TABLE\s+)?auth\.mail_outbox/i,
  /\bTO\s+PUBLIC\b/i,
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
const executableSurface = sqlGrantLines.join('\n') + '\n' + script.split(/\r?\n/).filter((line) => /docker\s+(restart|kill|rm)|docker\s+compose\s+(up|down|restart)|prisma\s+migrate\s+deploy|set\s+-x/.test(line)).join('\n');
for (const pattern of operationalForbidden) {
  if (pattern.test(executableSurface)) throw new Error(`forbidden operational surface: ${pattern}`);
}

if (!script.includes("known.has(x.effective_role)")) throw new Error('OTHER-role guard missing');
if (!script.includes('r.rolsuper || r.rolbypassrls || r.rolcreatedb || r.rolcreaterole || r.rolreplication')) throw new Error('privileged-role fail-closed guard missing');
if (!script.includes("tableAny ? 'TABLE_PRESENT' : 'TABLE_NONE'")) throw new Error('table privilege guard missing');
if (!script.includes("repair_success=1")) throw new Error('success latch missing');

console.log('production auth-mail API principal ACL repair contract: PASS');
