#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const paths = {
  preflight: '.github/workflows/tai-reg-ru-preflight.yml',
  deploy: '.github/workflows/tai-reg-ru-deploy.yml',
  activation: '.github/workflows/tai-restricted-qwen-reg-ru-activation.yml',
  installer: 'scripts/install-pc-prod-actions-runner.sh',
  activateScript: 'scripts/tai-restricted-qwen-reg-ru-activate.sh',
  ui: 'scripts/tai-live-public-ai-acceptance.mjs',
};
const text = Object.fromEntries(Object.entries(paths).map(([k,p]) => [k, readFileSync(p,'utf8')]));
const violations=[];
const requireFragment=(source,fragment,label)=>{if(!source.includes(fragment))violations.push(`${label}: missing ${JSON.stringify(fragment)}`)};
const forbid=(source,pattern,label)=>{if(pattern.test(source))violations.push(label)};

for (const name of ['preflight','deploy','activation']) {
  const source=text[name];
  for (const fragment of [
    'runs-on: [self-hosted, linux, x64, pc-prod, tai-release]',
    '[[ "${RUNNER_NAME:-}" == pc-prod-*',
    '"$(id -u)" -eq 0',
    'github.actor == github.repository_owner',
    'github.triggering_actor == github.repository_owner',
    '[[ "$TARGET_SHA" == "$(git rev-parse origin/main)" ]]',
    'packages: none',
    'statuses: none',
  ]) requireFragment(source,fragment,paths[name]);
  forbid(source,/PC_PROD_SSH_|PROD_HOST_SECRET|PROD_PORT_SECRET|PROD_KEY_|PROD_HOST_FINGERPRINT|id_pc_prod|prod_known_hosts/u,`${paths[name]}: production inbound SSH authority is forbidden`);
  forbid(source,/runs-on:\s*ubuntu[^\n]*\n(?:.|\n){0,500}name: .*local REG[.]RU/iu,`${paths[name]}: live production work must not run on GitHub-hosted runner`);
  forbid(source,/pull_request_target:/u,`${paths[name]}: pull_request_target is forbidden`);
  forbid(source,/ssh-keyscan/u,`${paths[name]}: live host-key discovery is forbidden`);
}

for (const fragment of [
  'RUNNER_VERSION="2.336.0"',
  'RUNNER_PACKAGE_SHA256="04cf0be1aff4c3ec3554466c39124ca250e3effd8873bb7e8d68535aa9505d5d"',
  'RUNNER_ALLOW_RUNASROOT=1 ./config.sh',
  '--labels "pc-prod,tai-release"',
  'RUNNER_ALLOW_RUNASROOT=1 ./svc.sh install root',
  'OUTBOUND_ONLY_HTTPS',
  'productionInboundSshRequired',
  'model_known_hosts',
  'modelKnownHostsSha256',
  'NoNewPrivileges=true',
  'ProtectKernelTunables=true',
  'ProtectKernelModules=true',
  'ProtectControlGroups=true',
]) requireFragment(text.installer,fragment,paths.installer);
forbid(text.installer,/echo[^\n]*(?:RUNNER_REGISTRATION_TOKEN|registration_token|token=)/iu,`${paths.installer}: registration token output is forbidden`);
forbid(text.installer,/set\s+-[^\n]*x/iu,`${paths.installer}: shell tracing is forbidden`);

for (const fragment of [
  'productionInboundSshUsed',
  'publicModelPortPublished',
  'compose.tai-restricted-qwen.override.yml',
  'rollback-qwen-env.sh',
  'RESTRICTED_QWEN_PRODUCTION_ENV=ACTIVE',
  'AI_ASSISTANT_BASE_URL',
  'TAI_PUBLIC_GATEWAY_HMAC_SECRET',
  'up -d --no-deps --pull never api web',
]) requireFragment(text.activateScript,fragment,paths.activateScript);
forbid(text.activateScript,/set\s+-[^\n]*x/iu,`${paths.activateScript}: shell tracing is forbidden`);
forbid(text.activateScript,/network_mode:\s*host|privileged:\s*true|\/var\/run\/docker[.]sock/iu,`${paths.activateScript}: privileged runtime configuration is forbidden`);
forbid(text.activateScript,/(?:AI_ASSISTANT_API_KEY|TAI_PUBLIC_GATEWAY_HMAC_SECRET)[^\n]*(?:echo|printf)/iu,`${paths.activateScript}: secret output is forbidden`);

for (const fragment of ['manifest_sha_mismatch','ИИ для агробизнеса','answer_too_short','ui_overflow','LIVE_PUBLIC_AI_UI=PASS']) requireFragment(text.ui,fragment,paths.ui);
forbid(text.ui,/192[.]168[.]0[.]206/u,`${paths.ui}: browser acceptance must not depend on private model address`);

if(violations.length){console.error('TAI REG.RU local runner contract failed:'); for(const v of violations)console.error(`- ${v}`); process.exit(1)}
console.log('TAI REG.RU local runner contract PASS: exact-main, outbound-only, production-local, root-authorized, rollback-bound and zero-cost.');
