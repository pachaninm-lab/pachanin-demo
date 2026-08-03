#!/usr/bin/env node
import {
  BOOTSTRAP_BLOCKERS,
  CRITICAL_PASS_CODES,
  classifyTaiPreflightReport,
} from './verify-tai-preflight-report.mjs';

const SHA = '1'.repeat(40);
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

expectPass('exact bootstrap set', clone(base), { allowBootstrap: true }, 'BOOTSTRAP_ELIGIBLE');
expectBlocked('bootstrap disabled', clone(base), { allowBootstrap: false });

const strict = clone(base);
strict.checks = strict.checks.map((check) => {
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

const unexpected = clone(base);
unexpected.checks.push({ name: 'runtime', status: 'BLOCKED', code: 'TAI_RUNTIME_UNHEALTHY' });
unexpected.blockers.push('TAI_RUNTIME_UNHEALTHY');
expectBlocked('unexpected additional blocker', unexpected);

const incompleteBootstrap = clone(base);
incompleteBootstrap.checks = incompleteBootstrap.checks.filter((check) => check.code !== BOOTSTRAP_BLOCKERS[0]);
incompleteBootstrap.blockers = incompleteBootstrap.blockers.filter((code) => code !== BOOTSTRAP_BLOCKERS[0]);
expectBlocked('incomplete bootstrap authority', incompleteBootstrap);

const missingCritical = clone(base);
missingCritical.checks = missingCritical.checks.filter((check) => check.code !== 'API_TO_PRIVATE_MODEL_HEALTHY');
expectBlocked('missing model connectivity', missingCritical);

const blockedCritical = clone(base);
blockedCritical.checks = blockedCritical.checks.map((check) => check.code === 'API_WEB_EXACT_MAIN'
  ? { ...check, status: 'BLOCKED', code: 'API_WEB_NOT_EXACT_MAIN' }
  : check);
blockedCritical.blockers.push('API_WEB_NOT_EXACT_MAIN');
expectBlocked('non-exact platform runtime', blockedCritical);

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
console.log('TAI bootstrap preflight contract PASS: only the exact safe materialization gap is bootstrap-eligible; strict postflight and all negative fixtures remain fail-closed.');
