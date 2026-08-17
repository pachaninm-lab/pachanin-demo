import fs from 'node:fs';

const scriptPath='scripts/production-p0-auth-mail-authority-cli-classifier-v2-3785.sh';
const workflowPath='.github/workflows/production-p0-auth-mail-authority-cli-classifier-v2-3785.yml';
const script=fs.readFileSync(scriptPath,'utf8');
const workflow=fs.readFileSync(workflowPath,'utf8');

const scriptMarkers=[
  "COMMAND='/production p0-auth-mail-authority-cli-classifier-v2 31988997036 current-main'",
  "[[ \"${PRODUCTION_MUTATION_ALLOWED:-false}\" == 'false' ]]",
  "[[ \"${PC_IS_PRODUCTION:-false}\" == 'true' ]]",
  "node_modules/prisma/build/index.js db execute --stdin --schema prisma/schema.prisma",
  "SET TRANSACTION READ ONLY",
  "REMOTE_STAGE='API_IDENTITY'",
  "REMOTE_STAGE='COMPOSE_AUTHORITY'",
  "REMOTE_STAGE='CLI_CLIENT'",
  "ADMIN_CLIENT|PASS",
  "FUNCTION_OWNER",
  "PUBLIC_EXECUTE",
  "TABLE_EFFECTIVE",
  "TABLE_DIRECT",
  "TABLE_PUBLIC",
  "PRODUCTION_MUTATION=NONE",
];
for(const marker of scriptMarkers){if(!script.includes(marker))throw new Error(`script missing: ${marker}`);}

const workflowMarkers=[
  "github.event.issue.number == 3072",
  "github.event.comment.author_association == 'OWNER'",
  "github.event.comment.body == '/production p0-auth-mail-authority-cli-classifier-v2 31988997036 current-main'",
  "PRODUCTION_MUTATION_ALLOWED: 'false'",
  "PC_IS_PRODUCTION: 'true'",
  "persist-credentials: false",
  "TRUSTED_CONNECTOR_APP_ID: '1144995'",
];
for(const marker of workflowMarkers){if(!workflow.includes(marker))throw new Error(`workflow missing: ${marker}`);}

const executable=script.split(/\r?\n/).filter(line=>{
  const t=line.trim();
  if(t.startsWith('#'))return false;
  if(t.startsWith('grep -Fq '))return false;
  return true;
}).join('\n');
const forbidden=[
  /\bGRANT\s+(?:USAGE|EXECUTE|SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER|ALL)\b/i,
  /\bREVOKE\s+(?:USAGE|EXECUTE|SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER|ALL)\b/i,
  /\bALTER\s+(?:ROLE|TABLE|FUNCTION)\b/i,
  /\bCREATE\s+(?:ROLE|TABLE|FUNCTION)\b/i,
  /\bDROP\s+(?:ROLE|TABLE|FUNCTION)\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\s+auth\./i,
  /\bDELETE\s+FROM\b/i,
  /\bTRUNCATE\s+(?:TABLE\s+)?auth\./i,
  /prisma\s+migrate\s+deploy/i,
  /docker\s+(?:restart|kill|rm)\b/i,
  /docker\s+compose\s+(?:up|down|restart)\b/i,
  /set\s+-x/,
];
for(const pattern of forbidden){if(pattern.test(executable))throw new Error(`mutation surface forbidden: ${pattern}`);}

const ro=(script.match(/SET TRANSACTION READ ONLY/g)||[]).length;
if(ro<2)throw new Error(`read-only transaction guards missing: ${ro}`);
if(!script.includes("raw DB role / role token / DB URL / credentials / SQL errors / PII"))throw new Error('redaction contract missing');
if(!script.includes("role_hex")||!script.includes("pg_catalog.decode('$role_hex','hex')"))throw new Error('safe target-role binding missing');
console.log('production auth-mail authority CLI classifier v2 contract: PASS');
