import fs from 'node:fs';
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

if (failures.length > 0) {
  console.error('Production web hardening check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('PASS: production web releases are exact-SHA, manifest-bound, protected-transport, stable-host-verified, persisted-image, web-only, health-gated, rollback-health-bounded, stream-diagnostic, checksummed, rollback-capable and independent of Watchtower.');
