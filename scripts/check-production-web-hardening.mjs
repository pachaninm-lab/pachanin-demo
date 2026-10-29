import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const files = {
  route: 'apps/web/app/api/health/ready/route.ts',
  dockerfile: 'infra/docker/Dockerfile.web',
  override: 'infra/compose/production-web-hardening.override.yml',
  release: 'scripts/production-web-exact-sha.sh',
  remote: 'scripts/production-web-remote-entrypoint.sh',
  live: 'scripts/production-web-live-acceptance.sh',
  workflow: '.github/workflows/production-web-exact-sha.yml',
  retryWorkflow: '.github/workflows/production-web-key-normalization-retry.yml',
  hardening: 'docs/ops/production-web-hardening.md',
  runbook: 'docs/ops/virtual-server-production-runbook.md',
  contour: 'docs/ops/active-hosting-contour.md',
  checklist: 'docs/ops/vps-post-deploy-checklist.md',
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
  const text = contents.get(name) ?? '';
  for (const needle of needles) {
    if (!text.includes(needle)) failures.push(`${files[name]}: missing ${JSON.stringify(needle)}`);
  }
}

function requirePattern(name, requirements) {
  const text = contents.get(name) ?? '';
  for (const { pattern, describe } of requirements) {
    if (!pattern.test(text)) failures.push(`${files[name]}: missing ${describe}`);
  }
}

function forbid(name, patterns) {
  const text = contents.get(name) ?? '';
  for (const pattern of patterns) {
    if (pattern.test(text)) failures.push(`${files[name]}: forbidden pattern ${pattern}`);
  }
}

requireText('route', [
  'status: \'ok\'',
  "releaseAuthority: 'exact-sha'",
  'process.env.APP_REVISION',
]);

// The property is that the readiness probe is never cached, anywhere. Pinning the
// exact header spelling made a *stronger* policy fail the gate: 90e52a9e8 added
// `no-cache, must-revalidate` and this check kept demanding the older, weaker
// string, so Production Hosting Authority went red on every push touching its
// trigger paths. Both binding directives are still mandatory; extra directives
// only tighten the policy and must never be a failure.
requirePattern('route', [
  {
    pattern: /'Cache-Control':\s*'(?=[^']*\bno-store\b)(?=[^']*\bmax-age=0(?![\d.]))[^']*'/,
    describe: "a Cache-Control header carrying both 'no-store' and 'max-age=0'",
  },
]);
requireText('dockerfile', [
  'ARG GIT_COMMIT=unknown',
  'COMMIT_REF="$GIT_COMMIT" BRANCH=main node scripts/write-deploy-evidence.mjs',
  'ENV APP_REVISION=$GIT_COMMIT',
  'HEALTHCHECK --interval=30s',
  '/api/health/ready',
  '/nodejs/bin/node',
  'USER nonroot',
]);
requireText('override', [
  'container_name: !reset null',
  'healthcheck:',
  'start_interval: 5s',
  'retired-watchtower',
  'restart: "no"',
]);
requireText('release', [
  'deploy|rollback',
  'Docker Compose >= 2.24.4',
  'COMPOSE_FILE_COUNT=',
  'org.opencontainers.image.revision',
  'PC_IMAGE_OVERRIDE=',
  'write_image_override',
  'PERSISTED_WEB_IMAGE=',
  '--pull never',
  'PC_LIVE_ACCEPTANCE_SCRIPT',
  'command -v python3',
  'Python 3 is required for strict live acceptance JSON parsing',
  'LEGACY_WEB_PARKED=1',
  'LEGACY_WEB_ADOPTED=1',
  'LEGACY_CONTAINER_RESTORED=',
  'INTERNAL_LIVE_ACCEPTANCE=PASS',
  'AUTOMATIC_ROLLBACK_ATTEMPTED=1',
  'ROLLBACK_HEALTH_ATTEMPT=',
  'ROLLBACK_READY=',
  'running web container lacks canonical Compose service label',
  'a non-web, non-Watchtower production container changed',
  'docker update --restart=no',
  'WATCHTOWER_RETIRED=1',
]);
requireText('remote', [
  'PERSISTENT_OVERRIDE_MUTATED=0',
  'PERSISTENT_OVERRIDE_MUTATED=1',
  'if [[ "$ACTION" == audit ]]',
  'compose.production-hardening.override.yml',
  'compose.production-web-image.override.yml',
  'grep -Ev',
  'hardening|web-image',
  'RESOLVED_PROTECTED_COMPOSE_COUNT=',
  'PC_IMAGE_OVERRIDE=',
  'PC_LIVE_ACCEPTANCE_SCRIPT=',
]);
requireText('live', [
  '/api/health/ready',
  '/manifest-pc-deploy.json',
  '?lang=ru',
  '?lang=en',
  '?lang=zh',
  'GEKTA_STREAM_DETAIL attempt=',
  'reserve_rc=%s',
  'stream_rc=%s',
  'ticket=%s',
  'content_type=%s',
  'body_bytes=%s',
  'extract_entitlement_ticket()',
  'answer_ticket="$(extract_entitlement_ticket "$reserve_body"',
  'LIVE_ACTION=',
  'LIVE_ACCEPTANCE=PASS',
]);
requireText('workflow', [
  'workflow_dispatch:',
  'DEPLOY-EXACT-SHA',
  'ROLLBACK-EXACT-SHA',
  'issues: write',
  'RELEASE_ISSUE_NUMBER: 3048',
  "github.actor == github.repository_owner",
  'PC_PROD_SSH_USER',
  'PC_PROD_SSH_KEY',
  'scripts/production-web-exact-sha.sh',
  'scripts/production-web-live-acceptance.sh',
  'scripts/production-web-remote-entrypoint.sh',
  'persistent_override_mutated',
  'deployed_revision',
  'deployed_state',
  'Restore previous exact revision after live failure',
  'Publish release record',
  'live-acceptance.log" 2>/dev/null | tail -1 || true',
  'release-issue-comment.md',
  'gh issue comment',
  'gh issue close',
  'LIVE_ACCEPTANCE=',
  'retention-days: 90',
]);

const workflow = contents.get('workflow') ?? '';
function canonicalTransportFailures(source) {
  const errors = [];
  const required = [
    'SSH_HOST_FINGERPRINT_SECRET: ${{ secrets.PC_PROD_SSH_HOST_FINGERPRINT }}',
    'expected_host_fingerprint="$(trim "${SSH_HOST_FINGERPRINT_SECRET:-}")"',
    'verify_pinned_host "$host" "$port" "$expected_host_fingerprint" "$HOME/.ssh/known_hosts"',
    '"$EVIDENCE_DIR/production-action.log" "$ACTION" "$TARGET_SHA" "$rc"',
    '"$EVIDENCE_DIR/live-failure-rollback.log" rollback "$BASELINE_SHA" "$rc"',
    'EVIDENCE_SCHEMA=pc.web-release-evidence.v1',
    'TRANSPORT_EXIT_CODE=',
    'Remove private runner release material',
  ];
  for (const needle of required) if (!source.includes(needle)) errors.push('missing canonical transport/evidence boundary');
  const pin = source.indexOf('          verify_pinned_host "$host"');
  const authenticated = source.indexOf('          ssh -i ');
  const copy = source.indexOf('          scp ');
  if (!(pin >= 0 && authenticated > pin && copy > authenticated)) errors.push('host pin must precede every authenticated transport');
  if ((source.match(/> "\$raw" 2>&1/g) ?? []).length !== 2 ||
      (source.match(/trap 'rm -f "\$raw"' EXIT/g) ?? []).length !== 2) errors.push('both remote outputs must remain private temporary files');
  for (const pattern of [
    /(?:cat|tee)\s+"?\$raw"?/,
    />\s*"\$EVIDENCE_DIR\/(?:production-action|live-failure-rollback)\.log"\s+2>&1/,
    /\|\s*tee\s+"\$EVIDENCE_DIR\/live-failure-rollback\.log"/,
    /StrictHostKeyChecking=no/,
    /UserKnownHostsFile=\/dev\/null/,
    /set\s+-x/,
  ]) if (pattern.test(source)) errors.push('raw output or host-verification bypass');
  return errors;
}
failures.push(...canonicalTransportFailures(workflow));
const canonicalMutants = [
  workflow.replace('SSH_HOST_FINGERPRINT_SECRET: ${{ secrets.PC_PROD_SSH_HOST_FINGERPRINT }}', ''),
  workflow.replace('          verify_pinned_host "$host"', '          : "$host"'),
  workflow.replace('          ssh -i ', '          ssh -i "$PRE_PIN_AUTH"\n          ssh -i ').replace('          verify_pinned_host "$host"', '          ssh -i "$PRE_PIN_AUTH"\n          verify_pinned_host "$host"'),
  workflow + '\ncat "$raw"\n',
  workflow.replace('> "$raw" 2>&1', '> "$EVIDENCE_DIR/production-action.log" 2>&1'),
];
for (const [index, mutant] of canonicalMutants.entries()) {
  if (canonicalTransportFailures(mutant).length === 0) failures.push('canonical transport negative control was accepted: ' + index);
}

const pinFunction = workflow.match(/^          verify_pinned_host\(\) \{\n[\s\S]*?^          \}/m)?.[0]?.replace(/^ {10}/gm, '');
const aggregateParser = workflow.match(/<<'PY_WEB_EVIDENCE'\n([\s\S]*?)^          PY_WEB_EVIDENCE$/m)?.[1]?.replace(/^ {10}/gm, '');
if (!pinFunction || !aggregateParser) {
  failures.push('Canonical host-pin function and bounded evidence parser must be executable by regression probes');
} else {
  const probeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-web-trust-probes-'));
  try {
    const publicBytes = Buffer.concat([
      Buffer.from([0, 0, 0, 11]), Buffer.from('ssh-ed25519'), Buffer.from([0, 0, 0, 32]), Buffer.alloc(32, 7),
    ]).toString('base64');
    const publicLine = 'example.invalid ssh-ed25519 ' + publicBytes;
    const fingerprintResult = spawnSync('ssh-keygen', ['-lf', '-', '-E', 'sha256'], { input: publicLine + '\n', encoding: 'utf8' });
    const fingerprint = fingerprintResult.stdout.trim().split(/\s+/)[1];
    if (fingerprintResult.status !== 0 || !/^SHA256:[A-Za-z0-9+/]{43}$/.test(fingerprint ?? '')) {
      failures.push('Synthetic public-only host-key fixture could not be fingerprinted');
    } else {
      const pinCases = [
        ['valid', fingerprint, publicLine, true],
        ['duplicate', fingerprint, publicLine + '\n' + publicLine, true],
        ['wrong', 'SHA256:' + 'A'.repeat(43), publicLine, false],
        ['missing', '', publicLine, false],
        ['malformed', 'SHA256:bad', publicLine, false],
        ['empty-scan', fingerprint, '', false],
        ['invalid-key', fingerprint, 'invalid public bytes', false],
        ['ambiguous', fingerprint, publicLine + '\n' + publicLine.replace('example.invalid', 'other.invalid'), false],
        ['keygen-error', fingerprint, publicLine, false],
        ['write-error', fingerprint, publicLine, false],
      ];
      const probe = [
        'set -euo pipefail',
        pinFunction,
        'ssh-keyscan() { printf "%s\\n" "$PIN_PROBE_SCAN"; }',
        'ssh-keygen() {',
        '  if [[ "$PIN_PROBE_CASE" == keygen-error ]]; then printf "256 %s synthetic\\n" "$PIN_PROBE_EXPECTED"; return 23; fi',
        '  command ssh-keygen "$@"',
        '}',
        'verify_pinned_host example.invalid 22 "$PIN_PROBE_EXPECTED" "$PIN_PROBE_KNOWN" || exit 77',
        'printf "AUTHENTICATED_TRANSPORT_ALLOWED\\n"',
      ].join('\n');
      for (const [name, expected, scan, shouldPass] of pinCases) {
        const known = path.join(probeRoot, 'known-' + name);
        if (name === 'write-error') fs.mkdirSync(known);
        const result = spawnSync('bash', ['-c', probe], { encoding: 'utf8', env: {
          ...process.env, PIN_PROBE_CASE: name, PIN_PROBE_EXPECTED: expected, PIN_PROBE_SCAN: scan, PIN_PROBE_KNOWN: known,
        } });
        if (shouldPass) {
          if (result.status !== 0 || result.stdout !== 'AUTHENTICATED_TRANSPORT_ALLOWED\n' ||
              fs.readFileSync(known, 'utf8') !== publicLine + '\n' || (fs.statSync(known).mode & 0o777) !== 0o600) {
            failures.push('Canonical pinned-host probe failed: ' + name);
          }
        } else if (result.status === 0 || result.stdout.includes('AUTHENTICATED_TRANSPORT_ALLOWED')) {
          failures.push('Canonical pinned-host probe accepted unsafe input: ' + name);
        }
      }
    }
    const revision = 'a'.repeat(40);
    const valid = [
      'DEPLOYMENT_COMPLETE=1', 'DEPLOYED_WEB_REVISION=' + revision, 'DEPLOYED_WEB_STATE=healthy',
      'ROLLBACK_BASELINE_REVISION=' + 'b'.repeat(40), 'WATCHTOWER_RETIRED=1', 'PERSISTENT_OVERRIDE_MUTATED=1',
      'PERSISTENT_IMAGE_OVERRIDE=/SYNTHETIC_PRIVATE_CANARY/compose.yml',
      'ERROR: SYNTHETIC_PRIVATE_CANARY must never enter logs or evidence',
    ].join('\n') + '\n';
    const aggregateCases = [
      ['deploy', valid, 'deploy', revision, '0', true],
      ['rollback', valid, 'rollback', revision, '0', true],
      ['audit', 'PERSISTENT_OVERRIDE_MUTATED=0\nCURRENT_WEB_REVISION=' + revision + '\nSYNTHETIC_PRIVATE_CANARY\n', 'audit', '', '0', true],
      ['failed-transport', 'SYNTHETIC_PRIVATE_CANARY\n', 'deploy', revision, '255', true],
      ['wrong-target', valid, 'deploy', 'c'.repeat(40), '0', false],
      ['duplicate', valid + 'DEPLOYMENT_COMPLETE=1\n', 'deploy', revision, '0', false],
      ['missing-revision', valid.replace('DEPLOYED_WEB_REVISION=' + revision + '\n', ''), 'deploy', revision, '0', false],
      ['missing-completion', valid.replace('DEPLOYMENT_COMPLETE=1\n', ''), 'deploy', revision, '0', false],
      ['bad-state', valid.replace('DEPLOYED_WEB_STATE=healthy', 'DEPLOYED_WEB_STATE=/SYNTHETIC_PRIVATE_CANARY'), 'deploy', revision, '0', false],
      ['unknown-execution', valid, 'deploy', revision, '255', false],
      ['oversized', 'X'.repeat(4 * 1024 * 1024 + 1), 'deploy', revision, '1', false],
      ['invalid-utf8', Buffer.from([255]), 'deploy', revision, '1', false],
    ];
    for (const [name, raw, action, target, status, shouldPass] of aggregateCases) {
      const input = path.join(probeRoot, name + '.raw');
      const output = path.join(probeRoot, name + '.log');
      fs.writeFileSync(input, raw);
      const result = spawnSync('python3', ['-c', aggregateParser, input, output, action, target, status], { encoding: 'utf8' });
      const evidence = fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '';
      if ((result.status === 0) !== shouldPass || (!shouldPass && evidence) ||
          (evidence + result.stdout + result.stderr).includes('SYNTHETIC_PRIVATE_CANARY')) {
        failures.push('Canonical aggregate evidence probe failed: ' + name);
      }
      if (shouldPass && (!evidence.includes('EVIDENCE_SCHEMA=pc.web-release-evidence.v1\n') ||
          !evidence.includes('TRANSPORT_EXIT_CODE=' + status + '\n') ||
          !/^RAW_OUTPUT_SHA256=[0-9a-f]{64}$/m.test(evidence))) {
        failures.push('Canonical aggregate evidence identity is missing: ' + name);
      }
    }
  } finally {
    fs.rmSync(probeRoot, { recursive: true, force: true });
  }
}
const recordIndex = workflow.indexOf('record="$EVIDENCE_DIR/release-issue-comment.md"');
const finalChecksumIndex = workflow.lastIndexOf('xargs -0 -r sha256sum > "$EVIDENCE_DIR/sha256.txt"');
if (recordIndex < 0 || finalChecksumIndex <= recordIndex) {
  failures.push(`${files.workflow}: release record must be created before the final evidence checksum manifest`);
}

const passwordName = 'PC_PROD_SSH_' + 'PASSWORD';
const fallbackPasswordName = 'VPS_SSH_' + 'PASSWORD';
const slotCommand = 'try_key_slot ';
const secondarySlot = slotCommand + 'PC_PROD_' + 'SSH_PRIVATE_KEY';
const fallbackSlot = slotCommand + 'VPS_' + 'SSH_KEY';
const primarySlot = slotCommand + 'PC_PROD_' + 'SSH_KEY';
const passwordPrimaryLabel = 'SSH_' + 'PASSWORD_PRIMARY:';
const passwordFallbackLabel = 'SSH_' + 'PASSWORD_FALLBACK:';
const privateSuffixCheck = "private_suffix='PRIVATE " + "KEY-----'";
requireText('retryWorkflow', [
  'TARGET_SHA: 58b46246ac67eb31a913a8da0de74a78ed1fd095',
  'EXACT_IMAGE: ghcr.io/pachaninm-lab/grainflow-web:sha-58b4624',
  passwordPrimaryLabel,
  passwordFallbackLabel,
  passwordName,
  fallbackPasswordName,
  'Resolve protected credential and pinned host identity',
  'validate_private_key()',
  'try_key_slot()',
  secondarySlot,
  fallbackSlot,
  primarySlot,
  privateSuffixCheck,
  'multiline-private-key',
  'escaped-newline-private-key',
  'base64-private-key',
  'ssh-keygen -y -P',
  'protected-password-fallback',
  'SSH_ASKPASS_REQUIRE=force',
  'setsid -w ssh',
  'setsid -w scp',
  'PreferredAuthentications=password',
  'PubkeyAuthentication=no',
  'NumberOfPasswordPrompts=1',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'expected_host_fingerprint',
  'for attempt in 1 2 3',
  'cmp -s "${scans[0]}" "${scans[1]}"',
  'stable-canonical-scan',
  'verified-secret',
  'StrictHostKeyChecking=yes',
  'ssh-host-key-fingerprints.txt',
  'Execute bounded web-only deployment',
  'PROD_DIR_B64=\'\' PROD_COMPOSE_B64=\'\' PROD_PROJECT_B64=\'\'',
  'Restore exact baseline after live failure',
  'PERSISTENT_IMAGE_OVERRIDE|PC_IMAGE_OVERRIDE|PROD_DIR|PRODUCTION_DIR|WORKDIR|CONFIG_FILES|COMPOSE_FILES?',
  '=[REDACTED]',
  'Publish retry record',
  'protected transport:',
  'deployment complete:',
  'running OCI revision:',
  'live acceptance:',
  'Watchtower retired:',
  'gh issue close',
  'retention-days: 90',
]);

const retryWorkflow = contents.get('retryWorkflow') ?? '';
const secondaryIndex = retryWorkflow.indexOf(secondarySlot);
const fallbackKeyIndex = retryWorkflow.indexOf(fallbackSlot);
const primaryIndex = retryWorkflow.indexOf(primarySlot);
const passwordFallbackIndex = retryWorkflow.indexOf('protected-password-fallback');
if (!(secondaryIndex >= 0 && fallbackKeyIndex > secondaryIndex && primaryIndex > fallbackKeyIndex && passwordFallbackIndex > primaryIndex)) {
  failures.push(`${files.retryWorkflow}: all protected private-key slots must be validated before password fallback`);
}
const retryRecordIndex = retryWorkflow.indexOf('record="$EVIDENCE_DIR/retry-issue-comment.md"');
const retryChecksumIndex = retryWorkflow.lastIndexOf('xargs -0 -r sha256sum > "$EVIDENCE_DIR/sha256.txt"');
if (retryRecordIndex < 0 || retryChecksumIndex <= retryRecordIndex) {
  failures.push(`${files.retryWorkflow}: retry record must be created before the final evidence checksum manifest`);
}

const literalPrivateHeader = new RegExp('-{5}BEGIN [A-Z0-9 ]+' + 'PRIVATE KEY-{5}');
forbid('retryWorkflow', [
  /sshpass/i,
  /grainflow-web:latest/,
  literalPrivateHeader,
  /echo\s+"?\$\{?SSH_(?:KEY|PASSWORD)/,
  /printf[^\n]*\$\{?SSH_(?:KEY|PASSWORD)/,
  /cat\s+.*id_pc_prod/,
  /set\s+-x/,
  /StrictHostKeyChecking=no/,
  /UserKnownHostsFile=\/dev\/null/,
  /docker compose[^\n]*up -d(?![^\n]*--no-deps)/,
]);

requireText('hardening', [
  'Watchtower is retired',
  'must not have a fixed `container_name`',
  'exact-SHA operations',
  'Docker Compose `2.24.4` or later',
  'parked legacy container',
  'compose.production-web-image.override.yml',
  'local retagging of an older SHA tag is prohibited',
]);
requireText('runbook', [
  'Watchtower is retired from release authority',
  'production-web-exact-sha.yml',
  'PC_TARGET_SHA',
  'PC_IMAGE_OVERRIDE',
  'org.opencontainers.image.revision',
  'compose.production-web-image.override.yml',
  '--pull never',
  'Docker Compose',
  'Caddy',
  'REG.RU',
]);
requireText('contour', [
  'Watchtower is retired',
  'The `web` service must not use a fixed `container_name`',
  'REG.RU',
  'Docker Compose',
]);
requireText('checklist', [
  'running OCI revision',
  'Docker reports the `web` container as `healthy`',
  'Contact dock acceptance',
  'Watchtower is stopped',
  'persistent exact-image override',
]);

forbid('workflow', [
  /sshpass/i,
  /PC_PROD_SSH_PASSWORD/,
  /VPS_SSH_PASSWORD/,
  /grainflow-web:latest/,
  /SSH_USER_SECRET:-root/,
]);
forbid('release', [
  /sshpass/i,
  /docker compose[^\n]*up -d(?![^\n]*--no-deps)/,
  /docker tag "\$exact_image"/,
]);
forbid('remote', [/sshpass/i, /PC_PROD_SSH_PASSWORD/, /VPS_SSH_PASSWORD/]);
forbid('live', [
  /cat\s+"?\$stream_body"?/,
  /(?:echo|printf)[^\n]*\$answer_ticket/,
  /node\s+-e/,
]);
forbid('hardening', [/Netlify.*production/i, /Vercel.*production/i]);

for (const path of [files.release, files.remote, files.live]) {
  const result = spawnSync('bash', ['-n', path], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${path}: bash -n failed: ${result.stderr.trim()}`);
}

// Exercise the actual Compose service check with web first in a long service
// list: grep -q in a pipe may close stdout early and fail under pipefail.
const releaseCode = contents.get('release') ?? '';
const serviceFunction = releaseCode.match(/^has_web_service\(\) \{\n[\s\S]*?^\}/m)?.[0];
if (!serviceFunction) {
  failures.push('Web release: missing executable Compose service check');
} else {
  const fakeCompose = [
    'BASE_DC=(docker compose)',
    'docker() {',
    '  [[ "$*" == "compose config --services" ]] || return 98',
    '  case "$TEST_CASE" in',
    '    first) printf "web\\n"; for ((i=0;i<5000;i++)); do printf "service-%s\\n" "$i"; done ;;',
    '    late) for ((i=0;i<5000;i++)); do printf "service-%s\\n" "$i"; done; printf "web\\n" ;;',
    '    missing) printf "web-old\\nother\\n" ;;',
    '    error) return 3 ;;',
    '  esac',
    '}',
    'has_web_service',
  ].join('\n');
  for (const testCase of ['first', 'late', 'missing', 'error']) {
    const result = spawnSync('bash', ['-c', 'set -euo pipefail\n' + serviceFunction + '\n' + fakeCompose], {
      encoding: 'utf8', env: { ...process.env, TEST_CASE: testCase },
    });
    const shouldPass = testCase === 'first' || testCase === 'late';
    if ((result.status === 0) !== shouldPass) {
      failures.push('Compose service check rejected/accepted ' + testCase + ': ' + result.stderr.trim());
    }
  }
}

const configStart = releaseCode.indexOf('merged_web_container_name="$(\n');
const configEnd = releaseCode.indexOf('\n)"', configStart);
if (configStart < 0 || configEnd < 0) {
  failures.push('Web release: missing merged Compose container-name probe');
} else {
  const configProbe = releaseCode.slice(configStart, configEnd + 3);
  const fakeConfig = [
    'BASE_DC=(docker compose)',
    'docker() {',
    '  [[ "$*" == "compose config" ]] || return 98',
    '  printf "services:\\n  web:\\n"',
    '  if [[ "$TEST_CASE" == named ]]; then printf "    container_name: forbidden\\n"; fi',
    '  printf "  api:\\n"',
    '  for ((i=0;i<5000;i++)); do printf "  service_%s:\\n    image: test\\n" "$i"; done',
    '}',
    configProbe,
    'printf "NAME=%s\\n" "$merged_web_container_name"',
  ].join('\n');
  for (const testCase of ['unnamed', 'named']) {
    const result = spawnSync('bash', ['-c', 'set -euo pipefail\n' + fakeConfig], {
      encoding: 'utf8', env: { ...process.env, TEST_CASE: testCase },
    });
    const expected = testCase === 'named' ? 'NAME=forbidden\n' : 'NAME=\n';
    if (result.status !== 0 || result.stdout !== expected) {
      failures.push('Compose name check failed for ' + testCase + ': ' + result.stderr.trim());
    }
  }
}

const live = contents.get('live') ?? '';
const extractor = live.match(/extract_entitlement_ticket\(\) \{\n[\s\S]*?\n\}/)?.[0];
if (!extractor) {
  failures.push(`${files.live}: entitlement JSON parser is not readable by the regression probe`);
} else {
  const validTicket = 'mtce8wuh.L18UUCeYU1yRvdgM';
  const extractorProbe = spawnSync(
    'bash',
    [
      '-c',
      `set -euo pipefail
${extractor}
parsed="$(extract_entitlement_ticket <(printf '%s\\n' '{"entitlement":{"state":"ANONYMOUS_FREE"},"allowed":true,"ticket":"${validTicket}"}'))"
[[ "$parsed" == '${validTicket}' ]]
[[ "$parsed" =~ ^[0-9a-z]{8,12}\\.[A-Za-z0-9_-]{16}$ ]]
! extract_entitlement_ticket <(printf '%s\\n' '{"allowed":false,"ticket":"${validTicket}"}') >/dev/null
! extract_entitlement_ticket <(printf '%s\\n' '{"meta":{"allowed":true,"ticket":"${validTicket}"},"allowed":false,"ticket":null}') >/dev/null
! extract_entitlement_ticket <(printf '%s\\n' '{"allowed":true,"ticket":"${validTicket}","allowed":false,"ticket":null}') >/dev/null`,
    ],
    { encoding: 'utf8' },
  );
  if (extractorProbe.status !== 0) {
    failures.push(
      `${files.live}: node-free entitlement ticket extraction probe failed: ${extractorProbe.stderr.trim()}`,
    );
  }
}

// Execute the actual resolver/reclaim functions with a bounded fake Docker CLI.
const remote = contents.get('remote') ?? '';
const shellFunction = (name) => remote.match(new RegExp('^' + name + '\\(\\) \\{\\n[\\s\\S]*?^\\}', 'm'))?.[0];
const reclaimFunctions = ['trim', 'fail', 'resolve_reclaim_web_id', 'reclaim_web_pull_space'].map(shellFunction);
if (reclaimFunctions.some((value) => !value)) {
  failures.push('Remote release: a reclaim function is missing');
} else {
  const fakeDocker = [
  "prod_dir=/protected-test",
  "prod_project=expected",
  "resolved_files=(compose.yml)",
  "TARGET_SHA=2222222222222222222222222222222222222222",
  "docker() {",
  "  case \"$1\" in",
  "    compose)",
  "      [[ \"$*\" == 'compose --project-directory /protected-test -p expected -f /protected-test/compose.yml ps -q web' ]] || return 91",
  "      case \"$TEST_CASE\" in",
  "        compose_error) return 3 ;;",
  "        zero) return 0 ;;",
  "        two) printf 'aaaaaaaaaaaa\\nbbbbbbbbbbbb\\n' ;;",
  "        *) printf 'aaaaaaaaaaaa\\n' ;;",
  "      esac ;;",
  "    inspect)",
  "      [[ \"$TEST_CASE\" != inspect_error ]] || return 4",
  "      case \"$3\" in",
  "        *com.docker.compose.service*)",
  "          case \"$TEST_CASE\" in wrong_service) echo api ;; missing_labels) echo '<no value>' ;; *) echo web ;; esac ;;",
  "        *com.docker.compose.project.working_dir*)",
  "          if [[ \"$TEST_CASE\" == wrong_directory ]]; then echo /other; else echo /protected-test; fi ;;",
  "        *com.docker.compose.project*)",
  "          if [[ \"$TEST_CASE\" == wrong_project ]]; then echo foreign; else echo expected; fi ;;",
  "        '{{.State.Running}}')",
  "          if [[ \"$TEST_CASE\" == stopped ]]; then echo false; else echo true; fi ;;",
  "        '{{.Config.Image}}') echo \"$TEST_IMAGE\" ;;",
  "        '{{.Image}}') echo sha256:current ;;",
  "        *) return 92 ;;",
  "      esac ;;",
  "    info) echo /tmp ;;",
  "    image)",
  "      case \"$2\" in",
  "        prune) echo MUTATION:prune >&3 ;;",
  "        ls)",
  "          printf '%s\\n' \\",
  "            'ghcr.io/pachaninm-lab/grainflow-web:sha-1111111 sha256:current' \\",
  "            'ghcr.io/pachaninm-lab/grainflow-web:sha-2222222 sha256:target' \\",
  "            'ghcr.io/pachaninm-lab/grainflow-web:sha-3333333 sha256:old' \\",
  "            'ghcr.io/pachaninm-lab/grainflow-api:sha-4444444 sha256:api' ;;",
  "        rm) echo \"MUTATION:remove:$3\" >&3 ;;",
  "        *) return 93 ;;",
  "      esac ;;",
  "    builder) echo MUTATION:builder >&3 ;;",
  "    *) return 94 ;;",
  "  esac",
  "}",
  "df() { :; }",
  "reclaim_web_pull_space",
  ""
].join('\n');
  const images = [
    'pc-crop-transfer/web:337e123ac52bfe5be3e0db8bb4cf0601f275edc8',
    'ghcr.io/pachaninm-lab/grainflow-web:sha-337e123',
    'sha256:5faab3e4282f3b803ac5c24fa4a0008030349a14292d30f135ec1064afac557e7',
  ];
  for (const testCase of ['valid', 'zero', 'two', 'wrong_service', 'missing_labels', 'wrong_project', 'wrong_directory', 'stopped', 'compose_error', 'inspect_error']) {
    for (const testImage of testCase === 'valid' ? images : images.slice(0, 1)) {
      const result = spawnSync('bash', ['-c', 'set -euo pipefail\nexec 3>&1\n' + reclaimFunctions.join('\n') + '\n' + fakeDocker], {
        encoding: 'utf8',
        env: { ...process.env, TEST_CASE: testCase, TEST_IMAGE: testImage },
      });
      const mutations = result.stdout.split('\n').filter((line) => line.startsWith('MUTATION:'));
      if (testCase === 'valid') {
        if (result.status !== 0 || !result.stdout.includes('DOCKER_RECLAIM_PRESERVED_IMAGE=ghcr.io/pachaninm-lab/grainflow-web:sha-1111111') ||
            !result.stdout.includes('DOCKER_RECLAIM_PRESERVED_IMAGE=ghcr.io/pachaninm-lab/grainflow-web:sha-2222222') ||
            !result.stdout.includes('DOCKER_RECLAIM_REMOVED_UNUSED_IMAGE=ghcr.io/pachaninm-lab/grainflow-web:sha-3333333') ||
            mutations.filter((line) => line.startsWith('MUTATION:remove:')).join('\n') !== 'MUTATION:remove:ghcr.io/pachaninm-lab/grainflow-web:sha-3333333') {
          failures.push('Compose reclaim valid image failed: ' + testImage + '; ' + result.stderr.trim());
        }
      } else if (result.status === 0 || mutations.length > 0) {
        failures.push('Compose reclaim must reject ' + testCase + ' before mutation');
      }
    }
  }
}
if (!/reclaim_web_pull_space\n\s+install -m 0644 "\$remote_override" "\$active_hardening_override"/u.test(remote)) {
  failures.push('Compose reclaim identity must be verified before persistent override installation');
}


// Execute the actual audit source; its routing never enters legacy rendering.
function readonlyAuditBoundary(source) {
  const errors = [];
  const step = source.match(/      - name: Observe persisted production preconditions without mutation\n[\s\S]*?(?=      - name: Copy immutable release assets\n)/)?.[0];
  const guard = "        if: steps.intent.outputs.action != 'audit'\n";
  if (!step) return ['missing early audit observer'];
  const header = step.split('        run: |\n', 1)[0];
  if (!header.split('\n').includes("        if: steps.intent.outputs.action == 'audit'") ||
      (header.match(/^        if:/gm) ?? []).length !== 1 || header.includes('continue-on-error:')) errors.push('audit must use only the exact default-success audit condition');
  const copyHeader = '      - name: Copy immutable release assets\n';
  const actionHeader = '      - name: Execute bounded production action\n';
  if (!source.includes(copyHeader + guard) || !source.includes(actionHeader + guard)) errors.push('both legacy asset/action steps must be excluded from audit');
  const inverse = source.replace(step, '').replace(copyHeader + guard, copyHeader).replace(actionHeader + guard, actionHeader);
  if (createHash('sha256').update(inverse).digest('hex') !== '7da7792ffcaf911c85c87cde4f4aa44366c0a480199407ea6cb32d9ccb85d0a2') errors.push('non-audit source bytes changed');
  return errors;
}
failures.push(...readonlyAuditBoundary(workflow));
for (const mutant of [
  workflow.replace("      - name: Copy immutable release assets\n        if: steps.intent.outputs.action != 'audit'\n", '      - name: Copy immutable release assets\n'),
  workflow.replace("        if: steps.intent.outputs.action == 'audit'\n", '        if: always()\n'),
  workflow.replace("        if: steps.intent.outputs.action == 'audit'\n", "        if: steps.intent.outputs.action == 'audit' || always()\n"),
  workflow.replace("        if: steps.intent.outputs.action == 'audit'\n", "        if: steps.intent.outputs.action == 'audit'\n        continue-on-error: true\n"),
]) if (readonlyAuditBoundary(mutant).length === 0) failures.push('unsafe audit workflow routing mutant accepted');
const readonlyAuditStep = workflow.match(/      - name: Observe persisted production preconditions without mutation\n[\s\S]*?(?=      - name: Copy immutable release assets\n)/)?.[0];
const readonlyAuditDriver = readonlyAuditStep?.match(/<<'PY_WEB_READONLY_AUDIT'\n([\s\S]*?)^          PY_WEB_READONLY_AUDIT$/m)?.[1]?.replace(/^ {10}/gm, '');
if (!readonlyAuditDriver) {
  failures.push('Actual early audit code must be extractable for regression probes');
} else {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-web-readonly-v3-probes-'));
  try {
    const driverFile = path.join(root, 'actual-driver.py');
    const probeFile = path.join(root, 'synthetic-probes.py');
    fs.writeFileSync(driverFile, readonlyAuditDriver, { mode: 0o600 });
    fs.writeFileSync(probeFile, "import contextlib\nimport copy\nimport hashlib\nimport io\nimport json\nimport os\nfrom pathlib import Path\nimport sys\nimport tempfile\n\ndriver_source = Path(sys.argv[1]).read_text()\ndriver = {'__name__': 'audit_probe'}\nexec(compile(driver_source, '<actual-workflow-driver>', 'exec'), driver)\ncollector = {'__name__': 'audit_probe_collector'}\nexec(compile(driver['COLLECTOR'], '<actual-workflow-collector>', 'exec'), collector)\ncollector['require_root'] = lambda: None\ncanary = 'SYNTHETIC_PRIVATE_AUDIT_CANARY'\nrevision = 'a' * 40\nsource = 'd' * 40\nimage_id = 'sha256:' + '1' * 64\nref = 'ghcr.io/pachaninm-lab/grainflow-web:sha-' + revision[:7]\nchecks = 0\n\ndef check(condition):\n    global checks\n    assert condition, 'AUDIT_PROBE_FAILED'\n    checks += 1\n\ndef reject(raw):\n    try:\n        driver['validate_report'](raw, source)\n    except (ValueError, UnicodeError, TypeError):\n        return True\n    return False\n\nwith tempfile.TemporaryDirectory(prefix='pc-web-audit-synthetic-') as tmp:\n    root = Path(tmp) / canary\n    root.mkdir()\n    compose = root / 'compose.yml'\n    compose.write_text(json.dumps({'name': 'synthetic', 'services': {'web': {'image': 'test'}, 'api': {'image': 'test', 'environment': {'PRIVATE': canary}}}}))\n    alternate = root / 'alternate.yml'\n    alternate.write_text(json.dumps({'name': 'alternate', 'services': {'web': {'image': 'test'}, 'api': {'image': 'test'}}}))\n    hardening = root / 'compose.production-hardening.override.yml'\n    hardening.write_text(canary + '-hardening')\n    image = root / 'compose.production-web-image.override.yml'\n    image.write_text(json.dumps({'services': {'web': {'image': ref}}}))\n    expected_hardening = hashlib.sha256(hardening.read_bytes()).hexdigest()\n    inputs = {'source_sha': source, 'directory': str(root), 'compose': str(compose),\n              'project': 'synthetic', 'hardening_sha256': expected_hardening}\n    base_labels = {'com.docker.compose.project': 'synthetic',\n                   'com.docker.compose.project.working_dir': str(root),\n                   'com.docker.compose.project.config_files': str(compose)}\n    web = {'Id': '1' * 64, 'Image': image_id, 'RestartCount': 0,\n           'Config': {'Image': ref, 'Labels': dict(base_labels, **{'com.docker.compose.service': 'web',\n                       'org.opencontainers.image.revision': revision})},\n           'State': {'Status': 'running', 'Health': {'Status': 'healthy'}, 'StartedAt': canary},\n           'NetworkSettings': {'Networks': {'synthetic': {'IPAddress': '172.20.0.2'}}}}\n    api = {'Id': '2' * 64, 'Config': {'Labels': dict(base_labels, **{'com.docker.compose.service': 'api'}),\n           'Env': ['DATABASE_URL=postgresql://private:synthetic-password@private-db/synthetic?schema=public']}}\n    caddy = {'Id': '3' * 64, 'Config': {'Image': 'caddy:2', 'Labels': dict(base_labels, **{'com.docker.compose.service': 'caddy'})}}\n    services = {'web': {'image': ref}, 'api': {'image': 'synthetic-api'},\n                'migration': {'image': 'ghcr.io/pachaninm-lab/grainflow-migration:sha-aaaaaaa',\n                    'environment': {'DATABASE_URL': 'postgresql://different:other-password@private-db/synthetic?schema=public'}}}\n    state = {}\n    calls = []\n    def reset():\n        state.clear()\n        state.update(rows=[web, api, caddy], services=copy.deepcopy(services), systemd=False,\n                     public_revision=revision, tag_id=image_id, alternate=False)\n        calls.clear()\n        compose.write_text(json.dumps({'name': 'synthetic', 'services': {'web': {'image': 'test'}, 'api': {'image': 'test', 'environment': {'PRIVATE': canary}}}}))\n        hardening.write_text(canary + '-hardening')\n        image.write_text(json.dumps({'services': {'web': {'image': ref}}}))\n    def fake(argv, payload=None, limit=1024 * 1024, seconds=10):\n        calls.append(argv)\n        if state.get('change_between_models') and argv[:2] == ['docker', 'compose'] and sum(c[:2] == ['docker', 'compose'] for c in calls) == 2:\n            compose.write_text(canary + '-between-models')\n        if argv == ['docker', 'ps', '-q', '--no-trunc']:\n            return ('\\n'.join(r['Id'] for r in state['rows']) + '\\n').encode()\n        if argv[:2] == ['docker', 'inspect']:\n            rows = [r for r in state['rows'] if r['Id'] == argv[2]]\n            assert len(rows) == 1\n            return json.dumps(rows).encode()\n        if argv[:3] == ['docker', 'image', 'inspect']:\n            assert argv[3] in (image_id, ref)\n            return json.dumps([{'Id': image_id if argv[3] == image_id else state['tag_id'],\n                               'Config': {'Labels': {'org.opencontainers.image.revision': revision}}}]).encode()\n        if argv[:2] == ['docker', 'compose']:\n            assert argv[-3:] == ['config', '--format', 'json']\n            selected = copy.deepcopy(state['services'])\n            snapshot_paths = [Path(argv[i + 1]) for i, arg in enumerate(argv[:-1]) if arg == '-f']\n            assert all(p.parent.stat().st_mode & 0o777 == 0o700 and p.stat().st_mode & 0o777 == 0o600 for p in snapshot_paths)\n            assert all(p not in (compose, alternate, hardening, image) for p in snapshot_paths)\n            initial = json.loads(snapshot_paths[0].read_text())\n            if initial.get('name') == 'alternate':\n                selected.pop('migration', None)\n            chosen = argv[argv.index('--project-name') + 1] if '--project-name' in argv else 'synthetic-default'\n            return json.dumps({'name': chosen, 'services': selected}).encode()\n        if argv == ['systemctl', 'show', 'caddy', '--property=ActiveState', '--value']:\n            if state.get('systemd_unknown'):\n                raise ValueError(canary)\n            return b'active\\n' if state['systemd'] else b'inactive\\n'\n        raise AssertionError('FORBIDDEN_AUDIT_COMMAND')\n    def http(url):\n        if url == 'http://127.0.0.1:2019/config/':\n            return {'apps': {'http': {'servers': {'s0': {'listen': [':443'], 'routes': [{'match': [{'host': [collector['DOMAIN']]}],\n                             'handle': [{'handler': 'reverse_proxy', 'upstreams': [{'dial': 'web:3000'}]}]}]}}}}}\n        assert url == 'https://' + collector['DOMAIN'] + '/api/health/ready'\n        if state.get('change_file'):\n            hardening.write_text(canary + '-changed-during-observation')\n        return {'status': 'ok', 'service': 'web', 'releaseAuthority': 'exact-sha',\n                'revision': state['public_revision'], 'privateIgnoredField': canary}\n    collector['bounded'] = fake\n    collector['get_json'] = http\n    def observe(values=None):\n        report = collector['collect'](values or inputs)\n        raw = json.dumps(report).encode()\n        admitted = driver['validate_report'](raw, source)\n        check(canary.encode() not in admitted and b'synthetic-password' not in admitted and b'private-db' not in admitted)\n        return report\n\n    reset()\n    report = observe()\n    for key, expected in {'selectors': 'EXPLICIT', 'label_model': 'OBSERVED', 'selected_model': 'OBSERVED',\n                         'models_relation': 'MATCH', 'migration': 'UNIQUE', 'migration_database': 'SAME_API_AUTHORITY',\n                         'persisted_model': 'OBSERVED', 'persisted_image': 'MATCH_RUNTIME_REF',\n                         'persisted_hardening': 'MATCH_SOURCE', 'container_image_binding': 'MATCH',\n                         'rollback_local': 'EXACT_LOCAL_MATCH', 'caddy_mode': 'COMPOSE', 'caddy_count': 1,\n                         'caddy_admin_route': 'MATCH', 'public_readiness': 'CURRENT_REVISION',\n                         'runtime_stability': 'UNCHANGED', 'observed_file_stability': 'UNCHANGED'}.items():\n        check(report[key] == expected)\n    check(all(cmd[0] in ('docker', 'systemctl') for cmd in calls))\n    check(all(not any(v in cmd for v in ('pull', 'load', 'up', 'restart', 'stop', 'rm', 'run', 'exec')) for cmd in calls))\n    reset(); state['services'].pop('migration'); check(observe()['migration'] == 'MISSING')\n    reset(); state['services']['migration2'] = copy.deepcopy(state['services']['migration']); check(observe()['migration'] == 'AMBIGUOUS')\n    reset(); state['services']['migration']['environment']['DATABASE_URL'] = 'postgresql://p:p@other-db/synthetic'; check(observe()['migration_database'] == 'DIFFERENT_API_AUTHORITY')\n    reset(); state['services']['migration']['environment']['DATABASE_URL'] = canary; check(observe()['migration_database'] == 'MALFORMED_OR_MISSING')\n    reset(); different = dict(inputs, compose=str(alternate)); check(observe(different)['models_relation'] == 'DIFFERENT')\n    reset(); defaults = dict(inputs, project=''); check(observe(defaults)['models_relation'] == 'DIFFERENT')\n    reset(); partial = dict(inputs, compose=''); check(observe(partial)['selectors'] == 'PARTIAL')\n    reset(); fallback = dict(inputs, directory='', compose=''); check(observe(fallback)['selectors'] == 'LABEL_FALLBACK')\n    reset(); state['tag_id'] = 'sha256:' + '2' * 64; check(observe()['rollback_local'] == 'LOCAL_TAG_REBOUND')\n    reset(); state['public_revision'] = 'b' * 40; check(observe()['public_readiness'] == 'DIFFERENT_REVISION')\n    reset(); state['public_revision'] = canary; check(observe()['public_readiness'] == 'NOT_READY')\n    reset(); state['rows'] = [web, api]; state['systemd'] = True; check(observe()['caddy_mode'] == 'SYSTEMD')\n    reset(); state['systemd'] = True; check(observe()['caddy_mode'] == 'AMBIGUOUS')\n    reset(); state['systemd_unknown'] = True; check(observe()['caddy_mode'] == 'NOT_PROVEN')\n    reset(); hardening.write_text('services:\\n  web:\\n    restart: always\\n'); check(observe()['persisted_hardening'] == 'DIFFERENT_SOURCE')\n    reset(); hardening.unlink(); check(observe()['persisted_hardening'] == 'ABSENT')\n    reset(); image.unlink(); check(observe()['persisted_model'] == 'NOT_PROVEN')\n    reset(); state['change_file'] = True; check(observe()['observed_file_stability'] == 'CHANGED')\n    reset(); state['change_between_models'] = True; check(observe()['observed_file_stability'] == 'CHANGED')\n    reset(); web2 = copy.deepcopy(web); web2['Id'] = '4' * 64; state['rows'] = [web, web2, api]; check(observe()['web_revision'] == 'unknown')\n    reset(); good = observe()\n    bads = [dict(good, privatePath=canary), dict(good, source_sha='e' * 40),\n            dict(good, caddy_count=True), dict(good, caddy_mode='SYSTEMD'),\n            dict(good, selectors='PARTIAL'), dict(good, web_revision=canary),\n            dict(good, migration=canary), dict(good, production_mutation='DEPLOY'),\n            dict(good, container_image_binding='NOT_PROVEN')]\n    for bad in bads:\n        check(reject(json.dumps(bad).encode()))\n    check(reject(b'\\xff'))\n    check(reject(b'x' * 4097))\n    check(reject(json.dumps(good).encode()[:-1] + b',\"caddy_count\":1}'))\n    raw_bounded = {'__name__': 'bounded_probe'}\n    exec(compile(driver['COLLECTOR'], '<bounded-probe>', 'exec'), raw_bounded)\n    try:\n        raw_bounded['bounded']([sys.executable, '-c', 'print(\"x\" * 8192)'], limit=4096, seconds=2)\n        check(False)\n    except ValueError:\n        check(True)\n    try:\n        raw_bounded['bounded']([sys.executable, '-c', 'import time;time.sleep(2)'], limit=64, seconds=.05)\n        check(False)\n    except ValueError:\n        check(True)\n    os.environ['EVIDENCE_DIR'] = tmp\n    os.environ['AUDIT_ACTION'] = 'deploy'\n    stale = Path(tmp) / 'readonly-preconditions.json'\n    stale.write_text(canary)\n    stdout, stderr = io.StringIO(), io.StringIO()\n    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):\n        try:\n            driver['main']()\n            check(False)\n        except SystemExit as e:\n            check(e.code == 1)\n    check(not stale.exists())\n    check(stdout.getvalue() == '' and stderr.getvalue() == 'Audit observation rejected.\\n')\n\n\n# Appended to the preserved/adapted positive regression probes above.\nimport re\nimport signal\nimport subprocess\nimport threading\nimport time\nfrom http.server import HTTPServer, BaseHTTPRequestHandler\n\nwith tempfile.TemporaryDirectory(prefix='pc-web-v2-closure-') as td:\n    root = Path(td)\n    safe = root / 'compose.yml'\n    child = root / 'child.yml'\n    child.write_text('include:\\n  - oci://synthetic.invalid/never-fetch\\n')\n    hard = root / 'compose.production-hardening.override.yml'\n    hard.write_text('services:\\n  web:\\n    restart: always\\n')\n    hard_hash = hashlib.sha256(hard.read_bytes()).hexdigest()\n    image = root / 'compose.production-web-image.override.yml'\n    image.write_text(json.dumps({'services': {'web': {'image': ref}}}))\n    vals = {'source_sha': source, 'directory': str(root), 'compose': str(safe),\n            'project': 'synthetic', 'hardening_sha256': hard_hash}\n    wl = {'com.docker.compose.project': 'synthetic', 'com.docker.compose.service': 'web',\n          'com.docker.compose.project.working_dir': str(root), 'com.docker.compose.project.config_files': str(safe),\n          'org.opencontainers.image.revision': revision}\n    row = {'Id': '4' * 64, 'Image': image_id, 'RestartCount': 0,\n           'Config': {'Image': ref, 'Labels': wl}, 'State': {'Status': 'running', 'Health': {'Status': 'healthy'}}}\n    ns = {'__name__': 'v2_negative_collector'}\n    exec(compile(driver['COLLECTOR'], '<actual-v2-collector>', 'exec'), ns)\n    ns['require_root'] = lambda: None\n    counters, owned = [], []\n    safe_raw = json.dumps({'services': {'web': {'image': ref}, 'api': {'image': 'synthetic-api'}}}).encode()\n    safe.write_bytes(safe_raw)\n    def fake(argv, payload=None, limit=1024 * 1024, seconds=10):\n        counters.append(argv)\n        if argv[:3] == ['docker', 'ps', '-q']:\n            return (row['Id'] + '\\n').encode()\n        if argv[:2] == ['docker', 'inspect']:\n            return json.dumps([row]).encode()\n        if argv[:3] == ['docker', 'image', 'inspect']:\n            return json.dumps([{'Id': image_id, 'Config': {'Labels': {'org.opencontainers.image.revision': revision}}}]).encode()\n        if argv[:2] == ['docker', 'compose']:\n            paths = [Path(argv[i + 1]) for i, v in enumerate(argv[:-1]) if v == '-f']\n            check(all(p != safe and p.parent.stat().st_mode & 0o777 == 0o700 and p.stat().st_mode & 0o777 == 0o600 for p in paths))\n            owned.extend(p.parent for p in paths)\n            safe.write_text('include:\\n  - oci://synthetic.invalid/changed-after-gate\\n')\n            # The renderer receives only the original checked private snapshot.\n            check(paths[0].read_bytes() == safe_raw)\n            return json.dumps({'services': {'web': {'image': ref}, 'api': {'image': 'synthetic-api'}}}).encode()\n        if argv[0] == 'systemctl':\n            return b'inactive\\n'\n        raise AssertionError('UNEXPECTED_READ_COMMAND')\n    ns['bounded'] = fake\n    ns['get_json'] = lambda url: {'status': 'ok', 'service': 'web', 'releaseAuthority': 'exact-sha', 'revision': revision}\n    blocked_inputs = [\n        'include:\\n  - oci://synthetic.invalid/never-fetch\\n',\n        'include:\\n  - https://synthetic.invalid/repository.git\\n',\n        'include:\\n  - child.yml\\n',\n        \"'include':\\n  - child.yml\\n\",\n        '\"\\\\u0069nclude\":\\n  - child.yml\\n',\n        '{\"\\\\u0069nclude\":[\"oci://synthetic.invalid/never-fetch\"]}',\n        'services:\\n  web:\\n    extends:\\n      file: child.yml\\n',\n        'x-defaults: &defaults\\n  image: synthetic\\nservices:\\n  web:\\n    <<: *defaults\\n',\n        'services: !unknown\\n  web:\\n    image: synthetic\\n',\n        'services: {web: {image: synthetic}}\\n',\n        '---\\nservices:\\n  web:\\n    image: synthetic\\n',\n        'services:\\n  web:\\n    image: first\\n    image: second\\n',\n    ]\n    for raw in blocked_inputs:\n        safe.write_text(raw)\n        counters.clear()\n        value = ns['collect'](vals)\n        check(value['closure'] == 'UNSUPPORTED' and value['observation'] == 'BLOCKED')\n        check(not any(c[:2] == ['docker', 'compose'] for c in counters))\n        check(value['snapshot_cleanup'] in ('COMPLETE', 'NOT_NEEDED'))\n        check(canary.encode() not in driver['validate_report'](json.dumps(value).encode(), source))\n    safe.write_bytes(safe_raw); counters.clear()\n    value = ns['collect'](vals)\n    check(value['closure'] == 'SUPPORTED' and value['snapshot_cleanup'] == 'COMPLETE')\n    check(value['observed_file_stability'] == 'CHANGED')\n    check(all(not p.exists() for p in owned))\n    # A mode/ownership uncertainty is recorded, never falsely called cleaned.\n    safe.write_bytes(safe_raw)\n    manual = ns['SnapshotSet'](hard_hash); entry = manual.add(safe); entry['path'].chmod(0o644)\n    check(manual.close() == 'UNKNOWN')\n    entry['path'].chmod(0o600); check(manual.close() == 'COMPLETE')\n    # Private snapshots are removed on an ordinary model exception, absolute\n    # collector deadline, SIGTERM and SIGHUP. Only this owned fixture PID is signalled.\n    cleanup_results = {}\n    for abort in ('exception', 'deadline', signal.SIGTERM, signal.SIGHUP):\n        safe.write_bytes(safe_raw); owned.clear()\n        base_fake = fake\n        def aborting(argv, **kwargs):\n            if argv[:2] == ['docker', 'compose']:\n                owned.append(ns['SNAPSHOTS'].directory)\n                if abort == 'deadline':\n                    time.sleep(.3)\n                elif abort == 'exception':\n                    raise ValueError(canary)\n                else:\n                    os.kill(os.getpid(), abort)\n            return base_fake(argv, **kwargs)\n        ns['bounded'] = aborting\n        value = ns['collect'](vals, seconds=.05 if abort == 'deadline' else 60)\n        check(value['snapshot_cleanup'] == 'COMPLETE' and all(not p.exists() for p in owned))\n        cleanup_results[str(abort)] = {'cleanup': value['snapshot_cleanup'], 'observation': value['observation']}\n        if abort == 'deadline':\n            check(value['observation'] == 'DEADLINE')\n        elif abort != 'exception':\n            check(value['observation'] == 'ABORTED')\n        check(signal.getitimer(signal.ITIMER_REAL)[0] == 0)\n        check(canary not in json.dumps(value))\n    ns['bounded'] = base_fake\n\n# Reproduce the independent V1 false MATCH and reject unsupported matchers.\nhttp_config = lambda route: {'apps': {'http': {'servers': {'s0': {'listen': [':443'], 'routes': [route]}}}}}\nproxy = {'handler': 'reverse_proxy', 'upstreams': [{'dial': 'web:3000'}]}\ndirect = {'match': [{'host': [collector['DOMAIN']]}], 'handle': [proxy]}\ncheck(collector['caddy_route'](http_config(direct), {}) == 'MATCH')\ncontradictory = {'match': [{'host': [collector['DOMAIN']]}], 'handle': [{'handler': 'subroute', 'routes': [\n    {'match': [{'host': ['other.example.test']}], 'handle': [proxy]}]}]}\ncheck(collector['caddy_route'](http_config(contradictory), {}) == 'NOT_PROVEN')\nfor matcher in ({'host': [collector['DOMAIN']], 'path': ['/other']}, {'path': ['/']}, {'host': ['*.example.test']}):\n    check(collector['caddy_route'](http_config({'match': [matcher], 'handle': [proxy]}), {}) == 'NOT_PROVEN')\ncheck(collector['caddy_route'](http_config(dict(direct, handle=[dict(proxy, dynamic_upstreams={})])), {}) == 'NOT_PROVEN')\n\n# Actual owned-loopback drip proof: the whole-body/global deadline interrupts\n# progress even when every socket read is faster than its socket timeout.\nclass Trickle(BaseHTTPRequestHandler):\n    def log_message(self, *args):\n        pass\n    def do_GET(self):\n        body = b'{\"ok\":true}'\n        self.send_response(200); self.send_header('Content-Length', str(len(body))); self.end_headers()\n        try:\n            for byte in body:\n                self.wfile.write(bytes([byte])); self.wfile.flush(); time.sleep(.07)\n        except (BrokenPipeError, ConnectionResetError):\n            pass\nserver = HTTPServer(('127.0.0.1', 0), Trickle)\nthread = threading.Thread(target=lambda: server.serve_forever(poll_interval=.01), daemon=True)\nthread.start()\ntry:\n    old_handler = signal.getsignal(signal.SIGALRM)\n    start = time.monotonic(); raw_bounded['DEADLINE'] = start + .25\n    try:\n        raw_bounded['get_json']('http://127.0.0.1:' + str(server.server_port) + '/')\n        check(False)\n    except raw_bounded['ObserverDeadline']:\n        drip_elapsed = time.monotonic() - start\n        check(drip_elapsed < .6)\n    check(signal.getsignal(signal.SIGALRM) == old_handler and signal.getitimer(signal.ITIMER_REAL)[0] == 0)\nfinally:\n    raw_bounded['DEADLINE'] = None\n    server.shutdown(); server.server_close(); thread.join(timeout=2)\n\n# A read-command leader that exits while its child retains stdout must not\n# escape deadline cleanup. No process outside this newly-created group is killed.\nwith tempfile.TemporaryDirectory(prefix='pc-web-owned-group-') as td:\n    pid_file = Path(td) / 'child.pid'\n    code = 'import subprocess,sys; p=subprocess.Popen([sys.executable,\"-c\",\"import time;time.sleep(10)\"]);open(sys.argv[1],\"w\").write(str(p.pid))'\n    try:\n        raw_bounded['bounded']([sys.executable, '-c', code, str(pid_file)], seconds=.15)\n        check(False)\n    except ValueError:\n        pid = int(pid_file.read_text())\n        proc = Path('/proc') / str(pid) / 'stat'\n        for _ in range(20):\n            if not proc.exists() or proc.read_text().split()[2] == 'Z':\n                break\n            time.sleep(.01)\n        check(not proc.exists() or proc.read_text().split()[2] == 'Z')\n\n# Whole workflow routing and actual hosted-driver admission/return/artifact.\nworkflow_text = Path(sys.argv[2]).read_text()\nstep = workflow_text.split('      - name: Observe persisted production preconditions without mutation\\n', 1)[1].split('      - name: Copy immutable release assets\\n', 1)[0]\ncopy_block = workflow_text.split('      - name: Copy immutable release assets\\n', 1)[1].split('      - name: Execute bounded production action\\n', 1)[0]\nproduction_block = workflow_text.split('      - name: Execute bounded production action\\n', 1)[1].split('      - name: Verify exact public runtime\\n', 1)[0]\nguard = \"        if: steps.intent.outputs.action != 'audit'\\n\"\ncheck(\"if: steps.intent.outputs.action == 'audit'\" in step and 'production.outcome' not in step)\ncheck(copy_block.count(guard) == 1 and production_block.count(guard) == 1)\ncheck(workflow_text.index('Observe persisted production preconditions') < workflow_text.index('Copy immutable release assets') < workflow_text.index('Execute bounded production action'))\nfor action in ('audit', 'deploy', 'rollback'):\n    for observer_success in (False, True):\n        success = observer_success if action == 'audit' else True\n        selected = success and action != 'audit'\n        check((not selected) if action == 'audit' else selected)\n\nwith tempfile.TemporaryDirectory(prefix='pc-web-driver-flow-') as td:\n    root = Path(td); (root / 'bin').mkdir(); (root / 'evidence').mkdir()\n    (root / 'infra/compose').mkdir(parents=True)\n    (root / 'infra/compose/production-web-hardening.override.yml').write_text('synthetic-public-source')\n    fake_ssh = root / 'bin/ssh'\n    fake_ssh.write_text('#!' + sys.executable + '\\nimport json,os,sys\\np=json.load(sys.stdin)\\nassert \"SYNTHETIC_PRIVATE_AUDIT_CANARY\" not in \" \".join(sys.argv)\\nassert p[\"inputs\"][\"directory\"].endswith(\"SYNTHETIC_PRIVATE_AUDIT_CANARY\")\\nassert \"StrictHostKeyChecking=yes\" in sys.argv\\nsys.stdout.write(open(os.environ[\"FAKE_AUDIT_REPORT\"]).read())\\n')\n    fake_ssh.chmod(0o700)\n    report_file = root / 'report.json'\n    env = dict(os.environ, PATH=str(root / 'bin') + os.pathsep + os.environ.get('PATH', ''),\n               EVIDENCE_DIR=str(root / 'evidence'), GITHUB_SHA=source, AUDIT_ACTION='audit',\n               AUDIT_HOST='195.19.12.120', AUDIT_USER='fixture_user', AUDIT_PORT='22',\n               PROD_DIR_SECRET='/' + canary, PROD_COMPOSE_SECRET=canary, PROD_PROJECT_SECRET='synthetic',\n               FAKE_AUDIT_REPORT=str(report_file))\n    supported = copy.deepcopy(good)\n    unsupported = copy.deepcopy(good)\n    unsupported.update(closure='UNSUPPORTED', observation='BLOCKED', label_model='NOT_PROVEN',\n                       selected_model='NOT_PROVEN', models_relation='NOT_PROVEN', persisted_model='NOT_PROVEN', persisted_image='NOT_PROVEN', persisted_hardening='NOT_PROVEN', migration='NOT_PROVEN', migration_database='NOT_PROVEN')\n    for report, expected in ((supported, 0), (unsupported, 2), (dict(supported, observation='DEADLINE'), 2), (dict(supported, snapshot_cleanup='UNKNOWN'), 2)):\n        report_file.write_text(json.dumps(report))\n        result = subprocess.run([sys.executable, str(Path(sys.argv[1]).resolve())], cwd=root, env=env, capture_output=True, text=True, timeout=5)\n        check(result.returncode == expected)\n        artifact = root / 'evidence/readonly-preconditions.json'\n        check(artifact.exists() and artifact.stat().st_mode & 0o777 == 0o600)\n        check(json.loads(artifact.read_text()) == report)\n        check(canary not in result.stdout + result.stderr)\n    report_file.write_text(json.dumps(dict(supported, privateUnknown=canary)))\n    result = subprocess.run([sys.executable, str(Path(sys.argv[1]).resolve())], cwd=root, env=env, capture_output=True, text=True, timeout=5)\n    check(result.returncode == 1 and not (root / 'evidence/readonly-preconditions.json').exists())\n    check(result.stdout == '' and result.stderr == 'Audit observation rejected.\\n')\n\n# V3 regression for the independently reproduced V2 allocation signal window.\nallocation_proof = {}\nwith tempfile.TemporaryDirectory(prefix='pc-web-v3-allocation-fixture-') as td:\n    root = Path(td); source_file = root / 'compose.json'\n    source_file.write_text(json.dumps({'services': {'web': {'image': ref}, 'api': {'image': 'synthetic-api'}}}))\n    row = {'Id': '5' * 64, 'Image': image_id,\n           'Config': {'Image': ref, 'Labels': {'com.docker.compose.service': 'web',\n               'com.docker.compose.project': 'synthetic', 'com.docker.compose.project.working_dir': td,\n               'com.docker.compose.project.config_files': str(source_file),\n               'org.opencontainers.image.revision': revision}}, 'State': {'Status': 'running'}}\n    ns = {'__name__': 'allocation_signal_regression'}\n    exec(compile(driver['COLLECTOR'], '<actual-v3-allocation-collector>', 'exec'), ns)\n    ns['require_root'] = lambda: None\n    renders = []\n    def fake_read(argv, **kwargs):\n        if argv[:3] == ['docker', 'ps', '-q']:\n            return (row['Id'] + '\\n').encode()\n        if argv[:2] == ['docker', 'inspect']:\n            return json.dumps([row]).encode()\n        if argv[:3] == ['docker', 'image', 'inspect']:\n            return json.dumps([{'Id': image_id, 'Config': {'Labels': {'org.opencontainers.image.revision': revision}}}]).encode()\n        renders.append(argv)\n        raise AssertionError('ALLOCATION_ABORT_MUST_PRECEDE_RENDER')\n    ns['bounded'] = fake_read\n    inputs = {'source_sha': source, 'directory': td, 'compose': str(source_file),\n              'project': 'synthetic', 'hardening_sha256': '0' * 64}\n    original_mkdtemp = ns['tempfile'].mkdtemp\n    for pending in (signal.SIGALRM, signal.SIGTERM, signal.SIGHUP):\n        created, timer_samples, captured_deadline = [], [], []\n        original_mask = signal.pthread_sigmask(signal.SIG_BLOCK, set())\n        def interrupted_allocation(*args, **kwargs):\n            path = original_mkdtemp(*args, **kwargs)\n            created.append(Path(path))\n            # This is an actual pending signal after successful mkdir, before\n            # mkdtemp has returned to the caller's directory assignment.\n            current_mask = signal.pthread_sigmask(signal.SIG_BLOCK, set())\n            check({signal.SIGALRM, signal.SIGTERM, signal.SIGHUP} <= current_mask)\n            captured_deadline.append(ns['DEADLINE'])\n            timer_samples.append(signal.getitimer(signal.ITIMER_REAL)[0])\n            os.kill(os.getpid(), pending)\n            check(ns['DEADLINE'] == captured_deadline[0])\n            timer_samples.append(signal.getitimer(signal.ITIMER_REAL)[0])\n            return path\n        ns['tempfile'].mkdtemp = interrupted_allocation\n        try:\n            value = ns['collect'](inputs)\n        finally:\n            ns['tempfile'].mkdtemp = original_mkdtemp\n        expected = 'DEADLINE' if pending == signal.SIGALRM else 'ABORTED'\n        check(value['observation'] == expected)\n        check(value['snapshot_cleanup'] == 'COMPLETE')\n        check(len(created) == 1 and not created[0].exists())\n        check(not renders)\n        check(timer_samples[1] <= timer_samples[0] and timer_samples[1] > 0)\n        check(signal.pthread_sigmask(signal.SIG_BLOCK, set()) == original_mask)\n        check(signal.getitimer(signal.ITIMER_REAL)[0] == 0 and ns['DEADLINE'] is None)\n        check(canary not in driver['validate_report'](json.dumps(value).encode(), source).decode())\n        allocation_proof[str(pending)] = {'observation': value['observation'],\n            'cleanup': value['snapshot_cleanup'], 'ownedDirectoryRemains': False,\n            'pendingSignalPreservedWithoutTimerRestart': True, 'renderCalls': 0}\n    # If a non-signal failure prevents the new identity from being returned,\n    # existence cannot be proved either way. Preserve UNKNOWN, never NOT_NEEDED.\n    created = []\n    def failed_identity_return(*args, **kwargs):\n        path = original_mkdtemp(*args, **kwargs)\n        created.append(Path(path))\n        raise ValueError(canary)\n    ns['tempfile'].mkdtemp = failed_identity_return\n    try:\n        value = ns['collect'](inputs)\n    finally:\n        ns['tempfile'].mkdtemp = original_mkdtemp\n    check(value['snapshot_cleanup'] == 'UNKNOWN')\n    check(len(created) == 1 and created[0].exists() and not list(created[0].iterdir()))\n    check(canary not in json.dumps(value) and not renders)\n    # Independent fixture ownership is known here; explicitly remove only its\n    # own empty directory after recording the truthful UNKNOWN result.\n    created[0].rmdir()\n    allocation_proof['identityUnestablished'] = {'cleanup': 'UNKNOWN',\n        'falseNotNeeded': False, 'fixtureOwnedEmptyDirectoryExplicitlyRemoved': True}\n\n\nnative_status = 'NOT_AVAILABLE'\nimport shutil\nif shutil.which('docker'):\n    version = subprocess.run(['docker', 'compose', 'version', '--short'], capture_output=True, timeout=10)\n    if version.returncode == 0:\n        native_status = 'PASS'\n        with tempfile.TemporaryDirectory(prefix='pc-web-native-config-') as td:\n            root = Path(td); path = root / 'compose.json'\n            path.write_text(json.dumps({'services': {'web': {'image': 'synthetic-readonly-no-pull:fixture'}, 'api': {'image': 'synthetic-readonly-no-pull:fixture'}}}))\n            ns = {'__name__': 'native_owned_fixture'}\n            exec(compile(driver['COLLECTOR'], '<actual-v2-native-collector>', 'exec'), ns)\n            snapshots = ns['SnapshotSet']('0' * 64); ns['SNAPSHOTS'] = snapshots\n            try:\n                value = ns['model'](td, 'syntheticreadonlyfixture', [path])\n                check(value['services']['web']['image'] == 'synthetic-readonly-no-pull:fixture')\n                check(value['services']['api']['image'] == 'synthetic-readonly-no-pull:fixture')\n                overlay = root / 'override.json'\n                overlay.write_text(json.dumps({'services': {'web': {'image': 'synthetic-override-no-pull:fixture'}}}))\n                layered = ns['model'](td, 'syntheticreadonlyfixture', [path, overlay])\n                check(layered['services']['web']['image'] == 'synthetic-override-no-pull:fixture')\n                reverse = ns['model'](td, 'syntheticreadonlyfixture', [overlay, path])\n                check(reverse['services']['web']['image'] == 'synthetic-readonly-no-pull:fixture')\n                old_project = os.environ.pop('COMPOSE_PROJECT_NAME', None)\n                try:\n                    default_value = ns['model'](td, '', [path])\n                    check(default_value['name'] == Path(td).name)\n                finally:\n                    if old_project is not None:\n                        os.environ['COMPOSE_PROJECT_NAME'] = old_project\n            finally:\n                check(snapshots.close() == 'COMPLETE')\nif len(sys.argv) > 3:\n    proof = {'schema': 'pc.web-audit-v2-local-proof.v1', 'syntheticAssertions': checks,\n             'actualDriverSha256': hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest(),\n             'actualCollectorSha256': hashlib.sha256(driver['COLLECTOR'].encode()).hexdigest(),\n             'unsupportedClosureCases': len(blocked_inputs), 'unsupportedComposeRenderCalls': 0,\n             'originalChangedAfterGate': 'RENDERED_CHECKED_PRIVATE_SNAPSHOT_ONLY',\n             'snapshotPermissions': '0700_DIRECTORY_0600_REGULAR_FILES',\n             'snapshotCleanupUncertainty': 'UNKNOWN_NOT_FALSE_COMPLETE',\n             'cleanupResults': cleanup_results,\n             'contradictoryNestedHosts': 'NOT_PROVEN', 'unsupportedCaddyMatchers': 'NOT_PROVEN',\n             'dripBodyBudgetSeconds': .25, 'dripBodyElapsedSeconds': drip_elapsed,\n             'dripBodyResult': 'ABSOLUTE_DEADLINE_INTERRUPTED',\n             'ownedChildGroupAfterDeadline': 'NOT_RUNNING',\n             'auditLegacyCopyAndRender': 'EXCLUDED_FOR_SUPPORTED_AND_BLOCKED_AUDITS',\n             'deployRollbackRouting': 'LEGACY_ONLY_OBSERVER_SKIPPED',\n             'hostedDriverReturns': {'supported': 0, 'unsupported': 2, 'deadline': 2, 'cleanupUnknown': 2, 'malformed': 1},\n             'admittedArtifactPrivacyAndMode': 'CLOSED_ENUMS_NO_PRIVATE_CANARY_0600',\n             'allocationSignalWindow': allocation_proof, 'actualNativeComposeConfig': native_status, 'productionNetworkOrHostActions': False}\n    Path(sys.argv[3]).write_text(json.dumps(proof, indent=2) + '\\n')\nprint('AUDIT_V3_NATIVE_CONFIG=' + native_status)\nprint('AUDIT_V3_PROBES_PASS=' + str(checks))\n", { mode: 0o600 });
    const result = spawnSync('python3', [probeFile, driverFile, files.workflow], { encoding: 'utf8', timeout: 30000 });
    const proof = result.stdout?.match(/^AUDIT_V3_NATIVE_CONFIG=(PASS|NOT_AVAILABLE)\nAUDIT_V3_PROBES_PASS=([0-9]+)\n$/);
    if (result.status !== 0 || !proof || Number(proof[2]) < 221 || result.stderr ||
        (result.stdout + result.stderr).includes('SYNTHETIC_PRIVATE_AUDIT_CANARY')) failures.push('Actual audit V3 source failed closure, routing, snapshot, private-canary or absolute-deadline probes');
    else console.log('READONLY_AUDIT_NATIVE_CONFIG=' + proof[1]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (failures.length > 0) {
  console.error('Production web hardening check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('PASS: production web releases are exact-SHA, manifest-bound, protected-transport, stable-host-verified, persisted-image, web-only, health-gated, rollback-health-bounded, stream-diagnostic, checksummed, rollback-capable and independent of Watchtower.');
