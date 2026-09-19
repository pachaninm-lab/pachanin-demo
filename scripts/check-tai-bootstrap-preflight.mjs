#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import {
  BOOTSTRAP_BLOCKERS,
  POST_FULL_STACK_BOOTSTRAP_BLOCKERS,
  CRITICAL_PASS_CODES,
  STRICT_ONLY_PASS_CODES,
  classifyTaiPreflightReport,
} from './verify-tai-preflight-report.mjs';

const SHA = '1'.repeat(40);
const workflowPath = '.github/workflows/tai-reg-ru-preflight-owner-command.yml';
const checkerPath = 'scripts/check-tai-bootstrap-preflight.mjs';
const dockerPublishPath = '.github/workflows/docker-publish.yml';
const triggerScopePath = 'docs/platform-v7/autopilot/scopes/tai-bootstrap-canonical-images-20260806.json';
const workflow = readFileSync(workflowPath, 'utf8');
const dockerPublish = readFileSync(dockerPublishPath, 'utf8');
const triggerScope = JSON.parse(readFileSync(triggerScopePath, 'utf8'));
const livePreflightStart = workflow.indexOf('\n  live_preflight:\n');
const publishStatusStart = workflow.indexOf('\n  publish_status:\n', livePreflightStart);
const resultGateStart = workflow.indexOf('\n  result_gate:\n', publishStatusStart);
const livePreflight = livePreflightStart >= 0 && publishStatusStart > livePreflightStart
  ? workflow.slice(livePreflightStart, publishStatusStart)
  : '';
const publishStatus = publishStatusStart >= 0 && resultGateStart > publishStatusStart
  ? workflow.slice(publishStatusStart, resultGateStart)
  : '';
const criticalChecks = CRITICAL_PASS_CODES.map((code, index) => ({
  name: `critical_${index}`,
  status: 'PASS',
  code,
}));
const bootstrapChecks = BOOTSTRAP_BLOCKERS.map((code, index) => ({
  name: `bootstrap_${index}`,
  status: 'BLOCKED',
  code,
}));
const base = {
  schemaVersion: 'tai.reg-ru.preflight.v1',
  targetSha: SHA,
  image: {
    reference: `ghcr.io/pachaninm-lab/grainflow-tai:sha-${SHA.slice(0, 7)}`,
    digest: `ghcr.io/pachaninm-lab/grainflow-tai@sha256:${'2'.repeat(64)}`,
  },
  generatedAt: '2026-08-02T00:00:00.000Z',
  mode: 'READ_ONLY_PREFLIGHT',
  productionMutationAllowed: false,
  checks: [
    ...criticalChecks,
    { name: 'model_admission', status: 'DEFERRED', code: 'MODEL_ADMISSION_NOT_ATTESTED' },
    ...bootstrapChecks,
  ],
  maturity: [{ name: 'model_admission', status: 'DEFERRED', code: 'MODEL_ADMISSION_NOT_ATTESTED' }],
  blockers: [...BOOTSTRAP_BLOCKERS].sort(),
  passed: false,
};

const clone = (value) => structuredClone(value);
const violations = [];
const requireWorkflowFragment = (fragment) => {
  if (!workflow.includes(fragment)) violations.push(`${workflowPath}: missing ${JSON.stringify(fragment)}`);
};
const requirePublishFragment = (fragment) => {
  if (!publishStatus.includes(fragment)) violations.push(`${workflowPath}: publish_status missing ${JSON.stringify(fragment)}`);
};
const requireDockerPublishFragment = (fragment) => {
  if (!dockerPublish.includes(fragment)) violations.push(`${dockerPublishPath}: missing ${JSON.stringify(fragment)}`);
};
const expectPass = (label, report, options, expectedClassification) => {
  try {
    const result = classifyTaiPreflightReport(report, SHA, options);
    if (result.classification !== expectedClassification) {
      violations.push(`${label}: expected ${expectedClassification}, got ${result.classification}`);
    }
  } catch (error) {
    violations.push(`${label}: unexpectedly blocked: ${error instanceof Error ? error.message : String(error)}`);
  }
};
const expectBlocked = (label, report, options = { allowBootstrap: true }, sha = SHA) => {
  try {
    classifyTaiPreflightReport(report, sha, options);
    violations.push(`${label}: unexpectedly passed`);
  } catch {
    // Expected fail-closed result.
  }
};

if (!livePreflight) violations.push(`${workflowPath}: live_preflight job boundary is missing`);
if (!publishStatus) violations.push(`${workflowPath}: publish_status job boundary is missing`);
if (/^\s{6}- uses:/mu.test(livePreflight)) {
  violations.push(`${workflowPath}: production self-hosted live_preflight job must be actionless`);
}
if (/actions\/(?:upload|download)-artifact@v4/u.test(livePreflight)) {
  violations.push(`${workflowPath}: artifact Actions are forbidden in production self-hosted live_preflight`);
}
if (/cancel-in-progress:\s*false/u.test(workflow)) {
  violations.push(`${workflowPath}: stale owner-preflight commands must be cancelled by the newest exact command`);
}
for (const fragment of [
  'cancel-in-progress: true',
  'outputs:\n      evidence_json: ${{ steps.evidence.outputs.json }}',
  '- name: Export bounded redacted preflight evidence',
  'id: evidence',
  "len(raw) > 65536",
  "json.dumps(payload, ensure_ascii=True, separators=(',', ':'))",
  '- name: Materialize bounded redacted preflight evidence',
  'PREFLIGHT_EVIDENCE_JSON: ${{ needs.live_preflight.outputs.evidence_json }}',
  "canonical != raw",
  'report.flush()',
  'os.fsync(report.fileno())',
  "'API_WEB_NOT_EXACT_MAIN'",
  "'API_WEB_EXACT_MAIN'",
  "codes = {row.get('code') for row in checks if isinstance(row, dict)}",
  "if blockers == full_stack_bootstrap:",
  "elif blockers == post_full_stack_bootstrap:",
  "print('POST_FULL_STACK_BOOTSTRAP_ELIGIBLE')",
]) requireWorkflowFragment(fragment);
if (/actions\/upload-artifact@v4/u.test(workflow)) {
  violations.push(`${workflowPath}: owner preflight may not upload evidence from the production runner with an Action`);
}
if (/actions\/download-artifact@v4/u.test(workflow)) {
  violations.push(`${workflowPath}: owner preflight evidence must be materialized from the bounded job output`);
}

for (const fragment of [
  'always() &&',
  'needs: [upstream_build_gate, contract, image_authority, live_preflight]',
  'issues: write',
  '- name: Resolve terminal target and stage',
  "stage='UPSTREAM_BUILD_GATE_FAILED'",
  "stage='PREFLIGHT_CONTRACT_FAILED'",
  "stage='IMAGE_AUTHORITY_FAILED'",
  "stage='PREFLIGHT_EVIDENCE_READY'",
  '- name: Classify accepted preflight evidence',
  '- name: Publish exact-main preflight status and terminal evidence',
  "context='TAI REG.RU Preflight'",
  'gh issue comment 3365',
  '- production mutation: \\`NONE\\`',
  '[[ "$state" == success ]]',
]) requirePublishFragment(fragment);

for (const fragment of [
  '- ".github/workflows/tai-reg-ru-preflight-owner-command.yml"',
  '- "scripts/verify-tai-preflight-report.mjs"',
  '- "scripts/check-tai-bootstrap-preflight.mjs"',
  '- "docs/platform-v7/autopilot/scopes/*bootstrap-preflight*.json"',
  '- "docs/platform-v7/autopilot/scopes/*bootstrap-canonical-images*.json"',
  '# Canonical API, web, TAI and migration images are published for the exact main SHA.',
]) requireDockerPublishFragment(fragment);

if (triggerScope.schemaVersion !== 'platform-v7.concurrent-scope.v1') {
  violations.push(`${triggerScopePath}: invalid schemaVersion`);
}
if (triggerScope.branch !== 'fix/tai-bootstrap-canonical-images-20260806') {
  violations.push(`${triggerScopePath}: branch mismatch`);
}
if (typeof triggerScope.baselineExactMain !== 'string' || !/^[0-9a-f]{40}$/u.test(triggerScope.baselineExactMain)) {
  violations.push(`${triggerScopePath}: baseline must be an exact SHA`);
}
const expectedTriggerPaths = [dockerPublishPath, checkerPath, triggerScopePath].sort();
const allowedTriggerPaths = Array.isArray(triggerScope.allowedPaths) ? [...triggerScope.allowedPaths].sort() : [];
if (JSON.stringify(expectedTriggerPaths) !== JSON.stringify(allowedTriggerPaths)) {
  violations.push(`${triggerScopePath}: allowedPaths must exactly match the canonical trigger implementation`);
}

expectPass('exact full-stack bootstrap set', clone(base), { allowBootstrap: true }, 'BOOTSTRAP_ELIGIBLE');
expectBlocked('bootstrap disabled', clone(base), { allowBootstrap: false });

const postFullStack = clone(base);
postFullStack.checks = postFullStack.checks.map((check) => check.code === 'API_WEB_NOT_EXACT_MAIN'
  ? { ...check, status: 'PASS', code: 'API_WEB_EXACT_MAIN' }
  : check);
postFullStack.blockers = [...POST_FULL_STACK_BOOTSTRAP_BLOCKERS].sort();
expectPass('post-full-stack TAI-only bootstrap set', postFullStack, { allowBootstrap: true }, 'POST_FULL_STACK_BOOTSTRAP_ELIGIBLE');
expectBlocked('post-full-stack bootstrap disabled', postFullStack, { allowBootstrap: false });

const postFullStackWithoutExact = clone(postFullStack);
postFullStackWithoutExact.checks = postFullStackWithoutExact.checks.filter((check) => check.code !== 'API_WEB_EXACT_MAIN');
expectBlocked('post-full-stack bootstrap without exact API/web authority', postFullStackWithoutExact);

const strict = clone(base);
strict.checks = strict.checks.map((check) => {
  if (check.code === 'API_WEB_NOT_EXACT_MAIN') {
    return { ...check, status: 'PASS', code: 'API_WEB_EXACT_MAIN' };
  }
  if (check.code === 'TAI_SERVICE_NOT_MATERIALIZED') {
    return { ...check, status: 'PASS', code: 'TAI_SERVICE_DECLARED' };
  }
  if (check.code === 'TAI_DEDICATED_ENV_NOT_MATERIALIZED') {
    return { ...check, status: 'PASS', code: 'TAI_DEDICATED_ENV_MATERIALIZED' };
  }
  if (check.code === 'TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED') {
    return { ...check, status: 'PASS', code: 'TAI_DEDICATED_DB_PRINCIPAL_ATTESTED' };
  }
  return check;
});
strict.blockers = [];
strict.passed = true;
expectPass('strict postflight', strict, { allowBootstrap: false }, 'STRICT_PASS');

const strictWithoutExact = clone(strict);
strictWithoutExact.checks = strictWithoutExact.checks.filter((check) => !STRICT_ONLY_PASS_CODES.includes(check.code));
expectBlocked('strict result without exact API/web authority', strictWithoutExact, { allowBootstrap: false });

const strictWithMismatch = clone(strict);
strictWithMismatch.checks.push({ name: 'api_web_nonexact', status: 'DEFERRED', code: 'API_WEB_NOT_EXACT_MAIN' });
expectBlocked('strict result with contradictory non-exact authority', strictWithMismatch, { allowBootstrap: false });

const unexpected = clone(base);
unexpected.checks.push({ name: 'runtime', status: 'BLOCKED', code: 'TAI_RUNTIME_UNHEALTHY' });
unexpected.blockers.push('TAI_RUNTIME_UNHEALTHY');
expectBlocked('unexpected additional blocker', unexpected);

const incompleteBootstrap = clone(base);
incompleteBootstrap.checks = incompleteBootstrap.checks.filter((check) => check.code !== BOOTSTRAP_BLOCKERS[0]);
incompleteBootstrap.blockers = incompleteBootstrap.blockers.filter((code) => code !== BOOTSTRAP_BLOCKERS[0]);
expectBlocked('three TAI blockers without exact API/web authority', incompleteBootstrap);

const falseExactAndMismatch = clone(base);
falseExactAndMismatch.checks.push({ name: 'api_web_exact', status: 'DEFERRED', code: 'API_WEB_EXACT_MAIN' });
expectBlocked('simultaneous exact and non-exact API/web authority', falseExactAndMismatch);

const missingCritical = clone(base);
missingCritical.checks = missingCritical.checks.filter((check) => check.code !== 'API_TO_PRIVATE_MODEL_HEALTHY');
expectBlocked('missing model connectivity', missingCritical);

const blockedBaseline = clone(base);
blockedBaseline.checks = blockedBaseline.checks.map((check) => check.code === 'API_WEB_BASELINE_HEALTHY'
  ? { ...check, status: 'BLOCKED', code: 'API_WEB_BASELINE_UNHEALTHY' }
  : check);
blockedBaseline.blockers.push('API_WEB_BASELINE_UNHEALTHY');
expectBlocked('unhealthy platform baseline', blockedBaseline);

const mutation = clone(base);
mutation.checks = mutation.checks.map((check) => check.code === 'NO_PRODUCTION_MUTATION_DETECTED'
  ? { ...check, status: 'BLOCKED', code: 'PRODUCTION_MUTATION_DETECTED' }
  : check);
mutation.blockers.push('PRODUCTION_MUTATION_DETECTED');
expectBlocked('mutation detected', mutation);

const inconsistent = clone(base);
inconsistent.blockers = [];
expectBlocked('blocked checks differ from blockers', inconsistent);

const wrongSha = clone(base);
wrongSha.targetSha = '3'.repeat(40);
expectBlocked('wrong target SHA', wrongSha);

const wrongImage = clone(base);
wrongImage.image.reference = 'ghcr.io/pachaninm-lab/grainflow-tai:sha-2222222';
expectBlocked('wrong target image', wrongImage);

const mutationAllowed = clone(base);
mutationAllowed.productionMutationAllowed = true;
expectBlocked('mutation allowed', mutationAllowed);

const malformed = clone(base);
malformed.checks = [];
expectBlocked('missing checks', malformed);

if (violations.length) {
  console.error('TAI bootstrap preflight contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('TAI bootstrap preflight contract PASS: owner preflight accepts only exact safe full-stack or post-full-stack bootstrap authority, preserves exact API/web semantics, cancels stale duplicates, publishes bounded evidence, and remains fail-closed.');
