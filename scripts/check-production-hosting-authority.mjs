import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const files = {
  agents: 'AGENTS.md',
  canonical: 'CANONICAL_DEPLOY.md',
  cutover: 'PRODUCTION_CUTOVER.md',
  contour: 'docs/ops/active-hosting-contour.md',
  runbook: 'docs/ops/virtual-server-production-runbook.md',
  checklist: 'docs/ops/vps-post-deploy-checklist.md',
  hardening: 'docs/ops/production-web-hardening.md',
  pilot: 'scripts/pilot-up.sh',
  override: 'infra/compose/production-web-hardening.override.yml',
  release: 'scripts/production-web-exact-sha.sh',
  remote: 'scripts/production-web-remote-entrypoint.sh',
  live: 'scripts/production-web-live-acceptance.sh',
};

const contents = new Map();
const failures = [];

for (const [name, filePath] of Object.entries(files)) {
  if (!fs.existsSync(filePath)) {
    failures.push(`${name}: missing ${filePath}`);
    continue;
  }
  contents.set(name, fs.readFileSync(filePath, 'utf8'));
}

function requireText(name, needles) {
  const text = contents.get(name) || '';
  for (const needle of needles) {
    if (!text.includes(needle)) failures.push(`${files[name]}: missing ${JSON.stringify(needle)}`);
  }
}

function forbid(name, patterns) {
  const text = contents.get(name) || '';
  for (const pattern of patterns) {
    if (pattern.test(text)) failures.push(`${files[name]}: forbidden stale hosting authority ${pattern}`);
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    failures.push(`${command} ${args.join(' ')} failed: ${String(result.stderr || result.stdout || '').trim()}`);
  }
  return result;
}

const commonAuthority = [
  'процент-агро.рф',
  '195.19.12.120',
  'REG.RU',
  'Caddy',
  'Docker Compose',
];

requireText('agents', [
  ...commonAuthority,
  'Netlify and Vercel are retired',
  'org.opencontainers.image.revision',
  'merge, green CI run or published GHCR image does not prove that production changed',
]);
requireText('canonical', [
  ...commonAuthority,
  'Netlify and Vercel are retired',
  'org.opencontainers.image.revision',
  'Definition of deployed',
]);
requireText('cutover', [...commonAuthority, 'VPS deployment pending']);
requireText('contour', [
  ...commonAuthority,
  'Netlify is retired',
  'Vercel is retired',
  'Watchtower is retired',
  'exact-SHA',
  'must not use a fixed `container_name`',
]);
requireText('runbook', [
  ...commonAuthority,
  'PC_TARGET_SHA',
  'PC_IMAGE_OVERRIDE',
  'org.opencontainers.image.revision',
  'production-web-exact-sha.yml',
  'Watchtower is retired from release authority',
  'compose.production-hardening.override.yml',
  'compose.production-web-image.override.yml',
  '--pull never',
]);
requireText('checklist', [
  'процент-агро.рф',
  'running OCI revision',
  'Contact dock acceptance',
  'Docker reports the `web` container as `healthy`',
  'Watchtower is stopped',
  'persistent exact-image override',
  'Merged `web.image` equals the requested immutable exact-SHA image',
]);
requireText('hardening', [
  'REG.RU',
  'exact-SHA operations',
  'Watchtower is retired',
  'must not have a fixed `container_name`',
  'Docker Compose `2.24.4` or later',
  'automatic rollback',
  'parked legacy container',
  'compose.production-web-image.override.yml',
  'local retagging of an older SHA tag is prohibited',
  '--pull never',
]);
requireText('override', [
  'container_name: !reset null',
  'healthcheck:',
  'retired-watchtower',
  'restart: "no"',
]);
requireText('release', [
  'PC_IMAGE_OVERRIDE=',
  'write_image_override',
  'PERSISTED_WEB_IMAGE=',
  '--pull never',
  'AUTOMATIC_ROLLBACK_ATTEMPTED=1',
  'LEGACY_WEB_PARKED=1',
  'INTERNAL_LIVE_ACCEPTANCE=PASS',
  'WATCHTOWER_RETIRED=1',
]);
requireText('remote', [
  'PERSISTENT_OVERRIDE_MUTATED=0',
  'PC_IMAGE_OVERRIDE=',
  'PC_LIVE_ACCEPTANCE_SCRIPT=',
  'compose.production-web-image.override.yml',
]);
requireText('live', ['LIVE_ACCEPTANCE=PASS', 'PC_LIVE_ACCEPTANCE_ATTEMPTS']);
requireText('pilot', [...commonAuthority, 'virtual-server deployment remains pending until verified']);

forbid('canonical', [
  /Host:\s*Netlify/i,
  /Netlify\s*\(sole production host\)/i,
  /Netlify Git integration builds/i,
  /Vercel is the production host/i,
]);
forbid('contour', [
  /Netlify is the sole production host/i,
  /Green working status:\s*`?@pc\/web`? build success \+ Netlify deploy/i,
  /Watchtower may perform the pull automatically/i,
]);
forbid('runbook', [
  /Allow Watchtower to pull/i,
  /docker compose[^\n]*pull web[\s\S]{0,120}docker compose[^\n]*up -d --no-deps web/i,
]);
forbid('hardening', [/grainflow-web:latest/i]);
forbid('release', [
  /sshpass/i,
  /PC_PROD_SSH_PASSWORD/,
  /VPS_SSH_PASSWORD/,
  /docker tag "\$exact_image"/,
]);
forbid('remote', [/sshpass/i, /PC_PROD_SSH_PASSWORD/, /VPS_SSH_PASSWORD/]);
forbid('cutover', [
  /Хостинг:\s*Netlify/i,
  /Netlify\s*→\s*Site settings/i,
  /дождаться прод-деплоя Netlify/i,
]);
forbid('pilot', [/Netlify/i, /Vercel/i]);

for (const shellFile of [files.release, files.remote, files.live]) {
  run('bash', ['-n', shellFile]);
}

if (fs.existsSync(files.override)) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-compose-hardening-'));
  const basePath = path.join(temporaryDirectory, 'base.yml');
  fs.writeFileSync(
    basePath,
    [
      'services:',
      '  web:',
      '    image: ghcr.io/pachaninm-lab/grainflow-web:sha-old000',
      '    container_name: legacy-fixed-web',
      '  watchtower:',
      '    image: containrrr/watchtower:latest',
      '    restart: always',
      '',
    ].join('\n'),
  );

  const imageOverridePath = path.join(temporaryDirectory, 'image.yml');
  fs.writeFileSync(
    imageOverridePath,
    [
      'services:',
      '  web:',
      '    image: ghcr.io/pachaninm-lab/grainflow-web:sha-new000',
      '',
    ].join('\n'),
  );

  const compose = run('docker', [
    'compose',
    '--profile',
    'retired-watchtower',
    '-f',
    basePath,
    '-f',
    files.override,
    '-f',
    imageOverridePath,
    'config',
    '--format',
    'json',
  ]);

  if (compose.status === 0) {
    try {
      const model = JSON.parse(compose.stdout);
      const web = model.services?.web;
      const watchtower = model.services?.watchtower;
      if (!web) failures.push('merged Compose model: web service is missing');
      if (web && 'container_name' in web) failures.push('merged Compose model: fixed web container_name survived !reset');
      if (!web?.healthcheck?.test) failures.push('merged Compose model: web healthcheck is missing');
      if (web?.image !== 'ghcr.io/pachaninm-lab/grainflow-web:sha-new000') {
        failures.push(`merged Compose model: exact image override lost authority (${web?.image ?? 'missing'})`);
      }
      if (!Array.isArray(watchtower?.profiles) || !watchtower.profiles.includes('retired-watchtower')) {
        failures.push('merged Compose model: Watchtower retired profile is missing');
      }
      if (watchtower?.restart !== 'no') failures.push('merged Compose model: Watchtower restart policy is not no');
    } catch (error) {
      failures.push(`merged Compose model is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

if (failures.length) {
  console.error('Production hosting authority check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('PASS: production authority is the REG.RU virtual server with exact-SHA, persisted-image, health-gated, syntax-checked and Compose-validated web releases; retired providers and Watchtower are not release gates.');
