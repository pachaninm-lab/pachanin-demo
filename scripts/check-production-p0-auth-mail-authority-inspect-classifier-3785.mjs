import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-auth-mail-authority-inspect-classifier-3785.yml';
const scriptPath = 'scripts/production-p0-auth-mail-authority-inspect-classifier-3785.sh';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');

const workflowMarkers = [
  "github.event.issue.number == 3072",
  "github.event.comment.author_association == 'OWNER'",
  "github.event.comment.body == '/production p0-auth-mail-authority-inspect-classifier 31987313660 current-main'",
  "PRODUCTION_MUTATION_ALLOWED: 'false'",
  "PC_IS_PRODUCTION: 'true'",
  'persist-credentials: false',
  "TRUSTED_CONNECTOR_APP_ID: '1144995'",
];
for (const marker of workflowMarkers) {
  if (!workflow.includes(marker)) throw new Error(`workflow missing: ${marker}`);
}

const scriptMarkers = [
  "COMMAND='/production p0-auth-mail-authority-inspect-classifier 31987313660 current-main'",
  "[[ \"${PRODUCTION_MUTATION_ALLOWED:-false}\" == 'false' ]]",
  "SET TRANSACTION READ ONLY",
  "REMOTE_STAGE='API_IDENTITY'",
  "REMOTE_STAGE='ADMIN_CLASSIFIER'",
  'pg_catalog.has_function_privilege($1::text,$2::oid',
  'pg_catalog.has_table_privilege($1::text,$2::oid',
  "PUBLIC_EXECUTE",
  "TABLE_EFFECTIVE",
  "TABLE_DIRECT",
  "TABLE_PUBLIC",
  "MEMBERSHIP_OUT",
  "MEMBERSHIP_IN",
  "ROLE_INHERIT",
  "ADMIN_SUPERUSER",
  "AUTH_MAIL_AUTHORITY_INSPECT_CLASSIFIER=PASS",
  "PRODUCTION_MUTATION=NONE",
];
for (const marker of scriptMarkers) {
  if (!script.includes(marker)) throw new Error(`script missing: ${marker}`);
}

const forbidden = [
  /\bGRANT\s+(?:USAGE|EXECUTE|SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER|ALL)\b/i,
  /\bREVOKE\s+(?:USAGE|EXECUTE|SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER|ALL)\b/i,
  /\bALTER\s+(ROLE|TABLE|FUNCTION)\b/i,
  /\bCREATE\s+(ROLE|TABLE|FUNCTION)\b/i,
  /\bDROP\s+(ROLE|TABLE|FUNCTION)\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\s+auth\./i,
  /\bDELETE\s+FROM\b/i,
  /\bTRUNCATE\s+(?:TABLE\s+)?auth\./i,
  /prisma\s+migrate\s+deploy/i,
  /docker\s+(restart|kill|rm)\b/i,
  /docker\s+compose\s+(up|down|restart)\b/i,
  /set\s+-x/,
];
const executable = script.split(/\r?\n/).filter((line) => {
  const t = line.trim();
  if (t.startsWith("grep -Fq '") || t.startsWith('grep -Fq "')) return false;
  if (t.startsWith('#')) return false;
  if (t.includes("password reset / mail send / deploy / GRANT / DDL / DML")) return false;
  return true;
}).join('\n');
for (const pattern of forbidden) {
  if (pattern.test(executable)) throw new Error(`mutation surface forbidden: ${pattern}`);
}

const roCount = (script.match(/SET TRANSACTION READ ONLY/g) || []).length;
if (roCount < 2) throw new Error(`expected API and admin read-only transaction guards; got ${roCount}`);
if (!script.includes("raw DB role / role digest / DB URL / credentials / SQL errors / PII")) throw new Error('redaction contract missing');
if (!script.includes("role_token=''") || !script.includes("Buffer.from(x.e,'utf8').toString('base64url')")) throw new Error('bounded in-remote role binding missing');
if (!script.includes("raw role/token and DB material never leave this remote process")) throw new Error('role non-publication contract missing');

console.log('production auth-mail authority-inspect classifier contract: PASS');
