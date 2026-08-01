#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const workflowPath='.github/workflows/tai-reg-ru-deploy.yml';
const deployPath='scripts/tai-reg-ru-deploy.sh';
const preflightPath='scripts/tai-reg-ru-preflight.sh';
const scopePath='docs/platform-v7/autopilot/scopes/tai-reg-ru-least-privilege-controller-20260731.json';
const workflow=readFileSync(workflowPath,'utf8');
const deploy=readFileSync(deployPath,'utf8');
const preflight=readFileSync(preflightPath,'utf8');
const scope=JSON.parse(readFileSync(scopePath,'utf8'));
const violations=[];
const requireFragment=(source,fragment,label)=>{if(!source.includes(fragment))violations.push(`${label}: missing ${JSON.stringify(fragment)}`)};
const forbid=(source,pattern,label)=>{if(pattern.test(source))violations.push(label)};

for(const fragment of [
  'Permanent model admission is required',"inputs.confirmation == 'DEPLOY-TAI-REG-RU'",
  'github.event_name == \'workflow_dispatch\'','github.ref == \'refs/heads/main\'',
  'github.actor == github.repository_owner','github.triggering_actor == github.repository_owner',
  '[[ "$TARGET_SHA" == "$(git rev-parse origin/main)" ]]','runs-on: [self-hosted, linux, x64, pc-prod, tai-readonly]',
  'Verify canonical exact-SHA rootless TAI image outside production','Verify direct production authority is absent',
  'sudo -n /usr/local/sbin/pc-tai-release-controller deploy','Upload exact-main deployment evidence',
  "context='TAI REG.RU Deployment'",
]) requireFragment(workflow,fragment,workflowPath);

for(const fragment of [
  'TAI_IMAGE_DIGEST','image: ${TAI_IMAGE_DIGEST}','docker pull "$TAI_IMAGE_DIGEST"','remote_digest_match=',
  '"$(docker inspect --format \'{{.Image}}\' "$tai_id")" = "$expected_image_id"',
  '"$(docker inspect --format \'{{.Config.Image}}\' "$tai_id")" = "$TAI_IMAGE_DIGEST"',
  'COMPOSE_JSON="$(mktemp)"','rm -f "$COMPOSE_JSON" "$TOPOLOGY_ENV"',"--filter 'label=com.docker.compose.service=tai'",
  'PREVIOUS_TAI_ROLLBACK_AUTHORITY_INCOMPLETE','user: "65532:65532"','read_only: true','cap_drop:','- ALL','no-new-privileges:true',
  'NOBYPASSRLS','NOSUPERUSER','NOCREATEDB','NOCREATEROLE','NOINHERIT','NOREPLICATION','rolinherit','has_table_privilege',
  "relation.relname NOT LIKE 'tai\\\\_%' ESCAPE '\\\\'",'nonTaiTableGrantCount','membershipCount','docker port "$tai_id"',
  'TAI_MODEL_BEARER_TOKEN=${model_token}','HMACPlatformIdentityAuthority','canonical_api_request_sha256','preparedActionCount','toolExecution',
  'TAI_REG_RU_DEPLOY_ROLLBACK=PASS','TAI_REG_RU_DEPLOYMENT_COMPLETE=1','tai.reg-ru.deployment.v1','newRecurringCostRub',
]) requireFragment(deploy,fragment,deployPath);
for(const fragment of ['TAI_SERVICE_NOT_MATERIALIZED','TAI_DEDICATED_ENV_NOT_MATERIALIZED','TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED','NO_PRODUCTION_MUTATION_DETECTED','compose.tai-agro-os.override.yml','TAI_OVERRIDE_PROTECTED','expected_image_id=','has_table_privilege']) requireFragment(preflight,fragment,preflightPath);

forbid(
  workflow,
  /workflow_run:\s*[\s\S]*TAI Restricted Qwen REG[.]RU Activation/u,
  `${workflowPath}: restricted activation must not auto-deploy standalone TAI`,
);
forbid(workflow,/PC_PROD_SSH_|PROD_HOST_SECRET|PROD_KEY_|PROD_HOST_FINGERPRINT|id_pc_prod|prod_known_hosts|\bscp\b/u,`${workflowPath}: production SSH transport is forbidden`);
forbid(workflow,/continue-on-error:\s*true/mu,`${workflowPath}: continue-on-error is forbidden`);
forbid(deploy,/set\s+-[^\n]*x/iu,`${deployPath}: shell tracing is forbidden`);
forbid(deploy,/^\s*ports\s*:/mu,`${deployPath}: public or host port publication is forbidden`);
forbid(deploy,/network_mode:\s*host|privileged:\s*true|^\s*cap_add\s*:|\/var\/run\/docker[.]sock/imu,`${deployPath}: privileged TAI container configuration is forbidden`);
forbid(deploy,/TAI_PLATFORM_TOOL_(?:BASE_URL|HMAC_SECRET)/u,`${deployPath}: platform tools must remain disabled-safe`);
forbid(deploy,/\b(?:netlify|vercel|railway|openai[.]com|anthropic[.]com)\b/iu,`${deployPath}: external hosting or cloud LLM dependency is forbidden`);
forbid(deploy,/GRANT\s+ALL\b|GRANT[^\n]+ON\s+ALL\s+TABLES/iu,`${deployPath}: broad database grant is forbidden`);
forbid(deploy,/docker\s+compose[^\n]+\bdown\b/iu,`${deployPath}: full Compose shutdown is forbidden`);
forbid(deploy,/(?:AI_ASSISTANT_API_KEY|TAI_MODEL_BEARER_TOKEN)[^\n]*(?:echo|printf)/iu,`${deployPath}: model credential output is forbidden`);

if(scope.schemaVersion!=='platform-v7.concurrent-scope.v1')violations.push(`${scopePath}: invalid schemaVersion`);
if(scope.branch!=='agent/tai-reg-ru-least-privilege-controller-20260731')violations.push(`${scopePath}: branch mismatch`);
if(scope.productionHosting!=='REG_RU_VPS_ONLY'||scope.newRecurringCostRub!==0)violations.push(`${scopePath}: hosting or cost boundary changed`);
if(scope.productionMutationAllowed!==true)violations.push(`${scopePath}: deployment mutation authority is absent`);
for(const p of [workflowPath,deployPath,preflightPath,'scripts/check-tai-reg-ru-deploy.mjs'])if(!scope.allowedPaths.includes(p))violations.push(`${scopePath}: ${p} outside allowedPaths`);

if(violations.length){console.error('TAI REG.RU deployment contract failed:');for(const v of violations)console.error(`- ${v}`);process.exit(1)}
console.log('TAI REG.RU deployment contract PASS: protected exact-main manual owner authority, immutable digest, rootless runtime, rollback-bound and zero-cost.');
