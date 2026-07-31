#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const workflowPath='.github/workflows/tai-reg-ru-preflight.yml';
const scriptPath='scripts/tai-reg-ru-preflight.sh';
const workflow=readFileSync(workflowPath,'utf8');
const script=readFileSync(scriptPath,'utf8');
const violations=[];
const requireFragment=(source,fragment,label)=>{if(!source.includes(fragment))violations.push(`${label}: missing ${JSON.stringify(fragment)}`)};
const forbid=(source,pattern,label)=>{if(pattern.test(source))violations.push(label)};

for(const fragment of [
  'workflow_run:','workflows: ["Build & Publish Canonical Docker Images"]',
  "inputs.confirmation == 'PREFLIGHT-TAI-REG-RU'",'github.actor == github.repository_owner',
  '[[ "$TARGET_SHA" == "$(git rev-parse origin/main)" ]]','runs-on: [self-hosted, linux, x64, pc-prod, tai-release]',
  'Verify canonical exact-SHA TAI image outside production','Execute local read-only production preflight',
  'Upload redacted preflight evidence','Publish exact-main preflight commit status',"context='TAI REG.RU Preflight'",
  'PREFLIGHT_NOT_EXECUTED','PREFLIGHT_EXECUTION_FAILED','productionMutationAllowed',
]) requireFragment(workflow,fragment,workflowPath);

for(const fragment of [
  'tai.reg-ru.preflight.v1','READ_ONLY_PREFLIGHT','productionMutationAllowed','snapshot_containers',
  'compose-hash.before','compose-hash.after','NO_PRODUCTION_MUTATION_DETECTED',
  'compose.tai-agro-os.override.yml','TAI_OVERRIDE_PROTECTED','TAI_OVERRIDE_PROTECTION_INVALID',
  'TAI_SERVICE_NOT_MATERIALIZED','TAI_SERVICE_DECLARED','TAI_RUNTIME_HEALTHY','TAI_RUNTIME_EXACT_MAIN','TAI_RUNTIME_ISOLATED',
  'TAI_DEDICATED_ENV_NOT_MATERIALIZED','TAI_DEDICATED_ENV_MATERIALIZED',
  'TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED','TAI_DEDICATED_DB_PRINCIPAL_ATTESTED',
  'TAI_READINESS_READY','TAI_READINESS_BLOCKED','API_TO_PRIVATE_MODEL_HEALTHY','API_WEB_EXACT_MAIN',
  'SET TRANSACTION READ ONLY',"namespace.nspname = 'public'",'admission.artifact_sha256 = profile.artifact_sha256',
  'ACTIVE_MODEL_IDENTITY_MATCHED','MODEL_ADMISSION_ACCEPTED','ACTIVE_KNOWLEDGE_READY',
  'expected_image_id=','expected_repo_digest=','"$tai_container_image_id" == "$expected_image_id"',
  '"$tai_config_image" == "$TAI_IMAGE_DIGEST"','docker port "$tai_id"','rolinherit','has_table_privilege',
  "relation.relname NOT LIKE 'tai\\\\_%' ESCAPE '\\\\'","components.get('tools') == 'disabled-safe'",
]) requireFragment(script,fragment,scriptPath);

forbid(workflow,/PC_PROD_SSH_|PROD_HOST_SECRET|PROD_KEY_|PROD_HOST_FINGERPRINT|ssh-keyscan|id_pc_prod|prod_known_hosts/u,`${workflowPath}: production SSH transport is forbidden`);
forbid(workflow,/continue-on-error:\s*true/mu,`${workflowPath}: continue-on-error is forbidden`);
forbid(workflow,/pull_request_target:/u,`${workflowPath}: pull_request_target is forbidden`);

const normalized=script.replace(/^\s*#.*$/gmu,'')
  .replace("trap 'rm -rf \"$work\"' EXIT",'')
  .replaceAll("'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'","'EFFECTIVE_TABLE_PRIVILEGES'")
  .replaceAll("'USAGE,SELECT,UPDATE'","'EFFECTIVE_SEQUENCE_PRIVILEGES'");
for(const [pattern,label] of [
  [/\bdocker\s+compose\b[^\n]*(?:\bup\b|\bdown\b|\brestart\b|\bpull\b|\bcreate\b|\brm\b)/iu,'production Docker Compose mutation'],
  [/\bdocker\s+(?:start|stop|restart|kill|rm|update|run|pull)\b/iu,'production container or image mutation'],
  [/\bsystemctl\s+(?:start|stop|restart|enable|disable|daemon-reload)\b/iu,'systemd mutation'],
  [/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/iu,'PostgreSQL mutation statement'],
  [/\b(?:install|cp|mv|chmod|chown|truncate)\s+[^\n]*\/(?:etc|srv|opt|var|home|root)\b/iu,'production filesystem mutation'],
  [/\b(?:kill|pkill|killall)\b/iu,'process mutation'],
]) forbid(normalized,pattern,`${scriptPath}: forbidden ${label}`);
forbid(script,/docker\s+inspect[^\n]*\.Config\.Env[^\n]*>\s*\/dev\/stdout/iu,`${scriptPath}: container environment must not be printed`);
forbid(script,/set\s+-[^\n]*x/iu,`${scriptPath}: shell tracing is forbidden`);
forbid(script,/(?:password|secret|api_key|database_url)\s*=.*(?:echo|printf)/iu,`${scriptPath}: secret-like values must not be printed`);
forbid(script,/^\s*ports\s*:/mu,`${scriptPath}: preflight must not define public ports`);

if(violations.length){console.error('TAI REG.RU preflight contract failed:'); for(const v of violations)console.error(`- ${v}`); process.exit(1)}
console.log('TAI REG.RU preflight contract PASS: exact-main, local, read-only, override-aware, digest-bound and fail-closed.');
