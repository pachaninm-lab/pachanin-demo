import fs from 'node:fs';

const files = {
  agents: 'AGENTS.md',
  canonical: 'CANONICAL_DEPLOY.md',
  cutover: 'PRODUCTION_CUTOVER.md',
  contour: 'docs/ops/active-hosting-contour.md',
  runbook: 'docs/ops/virtual-server-production-runbook.md',
  checklist: 'docs/ops/vps-post-deploy-checklist.md',
  hardening: 'docs/ops/production-web-hardening.md',
  pilot: 'scripts/pilot-up.sh',
};

const contents = new Map();
const failures = [];

for (const [name, path] of Object.entries(files)) {
  if (!fs.existsSync(path)) {
    failures.push(`${name}: missing ${path}`);
    continue;
  }
  contents.set(name, fs.readFileSync(path, 'utf8'));
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
  'org.opencontainers.image.revision',
  'production-web-exact-sha.yml',
  'Watchtower is retired from release authority',
  'compose.production-hardening.override.yml',
]);
requireText('checklist', [
  'процент-агро.рф',
  'running OCI revision',
  'Contact dock acceptance',
  'Docker reports the `web` container as `healthy`',
  'Watchtower is stopped',
]);
requireText('hardening', [
  'REG.RU',
  'exact-SHA operations',
  'Watchtower is retired',
  'must not have a fixed `container_name`',
  'Docker Compose `2.24.4` or later',
  'automatic rollback',
]);
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
forbid('cutover', [
  /Хостинг:\s*Netlify/i,
  /Netlify\s*→\s*Site settings/i,
  /дождаться прод-деплоя Netlify/i,
]);
forbid('pilot', [/Netlify/i, /Vercel/i]);

if (failures.length) {
  console.error('Production hosting authority check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('PASS: production authority is the REG.RU virtual server with exact-SHA, health-gated web releases; retired providers and Watchtower are not release gates.');
