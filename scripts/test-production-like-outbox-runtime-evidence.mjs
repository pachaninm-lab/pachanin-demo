import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const head = 'a'.repeat(40);
const runId = `ir2649-${head.slice(0, 12)}-1800000000`;
const ambiguity = 'MANUAL_REVIEW|AMBIGUOUS|WORKER_CRASH_OUTCOME_UNKNOWN|1800000070|no-lease|unsent';
const run = (name, cwd) => spawnSync(process.execPath, [path.join(root, 'scripts/release', name)], {
  cwd, env: { ...process.env, EXACT_HEAD: head, EVIDENCE_DIR: 'artifacts/industrial-readiness' }, encoding: 'utf8',
});

function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'outbox-runtime-evidence-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const dir = path.join(cwd, 'artifacts/industrial-readiness/kubernetes/outbox-runtime');
  fs.mkdirSync(dir, { recursive: true });
  const write = (name, value) => fs.writeFileSync(path.join(dir, name), typeof value === 'string' ? value : JSON.stringify(value));
  const runtime = {
    commitSha: head, runId, pass: true, result: 'PASS', violatedThresholds: [],
    actualMeasurements: {
      initialWorkerReplicas: 2, independentScaleTarget: 3, finalWorkerReplicas: 2,
      kafkaOutageFalseSent: 0, poisonDeadLetters: 1, poisonHealthyDelivered: 20,
      backlogEntries: 300, missingKafkaDeliveries: 0, duplicateKafkaDeliveries: 0,
      outageRecoverySeconds: 2, leaseRecoverySeconds: 60, backlogRecoverySeconds: 3,
    },
  };
  const snapshot = {
    schemaVersion: 1, commitSha: head, runId,
    outcomes: [
      ['graceful', 1, 1, 0, 0], ['outage', 20, 20, 0, 0], ['lease-kill', 1, 0, 0, 1],
      ['poison', 1, 0, 1, 0], ['poison-healthy', 20, 20, 0, 0], ['backlog', 300, 300, 0, 0],
    ].map(([scenario, total, delivered, dead, quarantined]) => ({ scenario, total, delivered, dead, quarantined, invalid: 0 })),
    quarantineEvidence: ambiguity,
  };
  write('outbox-worker-runtime-acceptance.json', runtime);
  write('stale-token-cas.json', { commitSha: head, pass: true, result: 'PASS', violatedAssertions: [] });
  write('terminal-outcome-counts.json', snapshot);
  write('lease-recovery-ambiguity.txt', ambiguity);
  write('killed-lease-snapshot.txt', 'worker-1|old-lease-token|1800000060');
  write('kafka-outage-summary.txt', 'sent=20 retries=0 recoverySeconds=2');
  write('poison-definitive-rejection.txt', 'DEAD_LETTER|1|PERMANENT|KAFKA_MESSAGE_TOO_LARGE|no-lease|unsent');
  const reportPath = path.join(cwd, 'artifacts/worker-topology/outbox-worker-acceptance.json');
  return {
    cwd, dir, write, runtime, snapshot, reportPath,
    build() {
      const result = run('build-production-like-outbox-runtime-evidence.mjs', cwd);
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    },
    enforce() { return run('enforce-production-like-outbox-runtime-evidence.mjs', cwd); },
  };
}

test('actual CLI derives 341 SENT, one dead letter and one unsent quarantine from 343 measured rows', (t) => {
  const f = fixture(t);
  const report = f.build();
  assert.equal(report.pass, true, JSON.stringify(report.violatedAssertions));
  assert.deepEqual([report.claimed, report.delivered, report.dead, report.quarantined, report.leaseLost], [343, 341, 1, 1, 1]);
  assert.equal(report.productionOperationallyAccepted, false);
  assert.equal(report.leaseQuarantine.code, 'WORKER_CRASH_OUTCOME_UNKNOWN');
  const enforced = f.enforce();
  assert.equal(enforced.status, 0, enforced.stderr);
  assert.match(enforced.stdout, /delivered=341, dead=1, quarantined=1/u);
});

const negativeCases = [
  ['missing terminal snapshot', (f) => fs.unlinkSync(path.join(f.dir, 'terminal-outcome-counts.json')), 'missingOrInvalidOutcomeSnapshot'],
  ['malformed terminal snapshot', (f) => f.write('terminal-outcome-counts.json', '{'), 'missingOrInvalidOutcomeSnapshot'],
  ['snapshot from another head', (f) => { f.snapshot.commitSha = 'b'.repeat(40); }, 'outcomeSnapshotExactHeadMismatch'],
  ['snapshot from another run', (f) => { f.snapshot.runId += '-old'; }, 'outcomeSnapshotRunMismatch'],
  ['342 SENT by replaying quarantined kill row', (f) => {
    const row = f.snapshot.outcomes.find((entry) => entry.scenario === 'lease-kill'); row.delivered = 1; row.quarantined = 0;
  }, 'outcomeScenarioMismatch:lease-kill'],
  ['missing delivered row', (f) => { f.snapshot.outcomes[0].total = 0; f.snapshot.outcomes[0].delivered = 0; }, 'outcomeScenarioMismatch:graceful'],
  ['unexpected extra scenario', (f) => { f.snapshot.outcomes.push({ ...f.snapshot.outcomes[0], scenario: 'unexpected' }); }, 'unexpectedOutcomeScenario:unexpected'],
  ['duplicate scenario masking missing scenario', (f) => { f.snapshot.outcomes[0].scenario = 'lease-kill'; }, 'missingOutcomeScenario:graceful'],
  ['terminal row still leased or invalid', (f) => { f.snapshot.outcomes[0].invalid = 1; }, 'nonterminalOrInvalidOutcome:graceful'],
  ['invalid numeric count', (f) => { f.snapshot.outcomes[0].delivered = '1'; }, 'invalidOutcomeCounts:graceful'],
  ['missing quarantine artifact', (f) => fs.unlinkSync(path.join(f.dir, 'lease-recovery-ambiguity.txt')), 'missingOrInvalidLeaseQuarantine'],
  ['missing killed lease artifact', (f) => fs.unlinkSync(path.join(f.dir, 'killed-lease-snapshot.txt')), 'missingOrInvalidKilledLeaseSnapshot'],
  ['quarantine before lease expiry', (f) => f.write('killed-lease-snapshot.txt', 'worker-1|old-lease-token|1800000080'), 'quarantineBeforeLeaseExpiry'],
  ['final quarantine differs from observed quarantine', (f) => { f.snapshot.quarantineEvidence = ambiguity.replace('unsent', 'sent'); }, 'finalQuarantineEvidenceMismatch'],
  ['quarantine has wrong error classification', (f) => f.write('lease-recovery-ambiguity.txt', ambiguity.replace('AMBIGUOUS', 'TRANSIENT')), 'missingOrInvalidLeaseQuarantine'],
  ['missing retry evidence', (f) => fs.unlinkSync(path.join(f.dir, 'kafka-outage-summary.txt')), 'missingOrInvalidOutageRetryEvidence'],
  ['poison falsely marked retriable', (f) => f.write('poison-definitive-rejection.txt', 'DEAD_LETTER|1|TRANSIENT|KAFKA_MESSAGE_TOO_LARGE|no-lease|unsent'), 'poisonDefinitiveCategory'],
];
for (const [name, mutate, expected] of negativeCases) {
  test(`actual CLI rejects ${name}`, (t) => {
    const f = fixture(t);
    const before = JSON.stringify(f.snapshot);
    mutate(f);
    if (JSON.stringify(f.snapshot) !== before) f.write('terminal-outcome-counts.json', f.snapshot);
    const report = f.build();
    assert.equal(report.pass, false);
    assert.ok(report.violatedAssertions.includes(expected), JSON.stringify(report.violatedAssertions));
    assert.notEqual(f.enforce().status, 0);
  });
}

test('enforcer rejects a forged 342-SENT PASS even when builder assertions were removed', (t) => {
  const f = fixture(t);
  const report = f.build();
  report.delivered = 342;
  fs.writeFileSync(f.reportPath, JSON.stringify(report));
  const enforced = f.enforce();
  assert.notEqual(enforced.status, 0);
  assert.match(enforced.stderr, /delivered=342 measured=341/u);
});

test('enforcer requires measured source artifacts after canonical report generation', (t) => {
  const f = fixture(t);
  f.build();
  fs.unlinkSync(path.join(f.dir, 'lease-recovery-ambiguity.txt'));
  const enforced = f.enforce();
  assert.notEqual(enforced.status, 0);
  assert.match(enforced.stderr, /missingOrInvalidLeaseQuarantine/u);
});

test('enforcer rejects replayed kill row even if summary and snapshot are changed together', (t) => {
  const f = fixture(t);
  const report = f.build();
  const row = f.snapshot.outcomes.find((entry) => entry.scenario === 'lease-kill');
  row.delivered = 1;
  row.quarantined = 0;
  report.delivered = 342;
  report.quarantined = 0;
  report.outcomeSnapshot = f.snapshot;
  f.write('terminal-outcome-counts.json', f.snapshot);
  fs.writeFileSync(f.reportPath, JSON.stringify(report));
  const enforced = f.enforce();
  assert.notEqual(enforced.status, 0);
  assert.match(enforced.stderr, /outcomeScenarioMismatch:lease-kill/u);
});

test('saved wrapper renders executable final snapshot before cleanup without changing claim fence', (t) => {
  const f = fixture(t);
  const wrapper = fs.readFileSync(path.join(root, 'scripts/release/production-like-kubernetes-outbox-runtime.sh'), 'utf8');
  const script = wrapper.match(/node <<'NODE'\n([\s\S]*?)\nNODE/u)?.[1];
  assert.ok(script, 'wrapper rendering program exists');
  const generated = path.join(f.cwd, 'generated.sh');
  const rendered = spawnSync(process.execPath, ['-e', script], {
    env: { ...process.env, BASE_SCRIPT: path.join(root, 'scripts/release/production-like-kubernetes-outbox-runtime-base.sh'), GENERATED_SCRIPT: generated },
    encoding: 'utf8',
  });
  assert.equal(rendered.status, 0, rendered.stderr);
  const source = fs.readFileSync(generated, 'utf8');
  const snapshotAt = source.indexOf('# Capture measured terminal outcomes');
  assert.ok(snapshotAt > 0);
  assert.ok(source.indexOf('terminal-outcome-counts.json', snapshotAt) < source.lastIndexOf('delete_run_rows'));
  assert.match(source, /BEGIN; SET LOCAL pc_crop\.outbox_claim_protocol = '2'; \$sql; COMMIT;/u);
  assert.match(source, /psql -q -v ON_ERROR_STOP=1 -U app_outbox/u);
  assert.match(source.slice(snapshotAt), /'commitSha', '\$\{EXACT_HEAD\}', 'runId', '\$\{RUN_ID\}'/u);
  const syntax = spawnSync('bash', ['-n', generated], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
});

for (const diagnosticFailure of [false, true]) {
  test(`failed runtime preserves its exit code with ${diagnosticFailure ? 'unavailable' : 'available'} diagnostics`, (t) => {
    const f = fixture(t);
    f.runtime.pass = false;
    f.runtime.result = 'FAIL';
    f.write('outbox-worker-runtime-acceptance.json', f.runtime);
    const reportBefore = fs.readFileSync(path.join(f.dir, 'outbox-worker-runtime-acceptance.json'), 'utf8');
    const wrapper = fs.readFileSync(path.join(root, 'scripts/release/production-like-kubernetes-outbox-runtime.sh'), 'utf8');
    const suffix = wrapper.slice(wrapper.indexOf('capture_failure_diagnostics() {'));
    assert.ok(suffix.startsWith('capture_failure_diagnostics() {'));
    const bin = path.join(f.cwd, 'bin');
    fs.mkdirSync(bin);
    const mock = `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
if (process.env.DIAGNOSTIC_FAILURE === '1') process.exit(77);
if (args[0] === 'exec') {
  const sql = args.at(-1);
  fs.appendFileSync(process.env.SQL_AUDIT, sql + '\\n');
  if (!sql.includes('SELECT') || /\\b(?:UPDATE|DELETE|INSERT|ALTER)\\b/.test(sql)) process.exit(78);
  console.log(JSON.stringify({groups:[{status:'PENDING',count:100}]}));
} else if (args[0] === 'get') {
  console.log(JSON.stringify({items:[{metadata:{name:'grainflow-outbox-worker-test'},spec:{secret:'SENSITIVE_FIXTURE'},status:{phase:'Running',containerStatuses:[{name:'outbox',ready:true,restartCount:2}]}}]}));
} else if (args[0] === 'logs') {
  console.log('[pod/grainflow-outbox-worker-test/outbox] Outbox drain claimed=25 delivered=20 retried=0 dead=0 manualReview=5 leaseLost=0 SENSITIVE_FIXTURE');
  console.log('[pod/grainflow-outbox-worker-test/outbox] P2024 SENSITIVE_FIXTURE');
  console.log('payload=SENSITIVE_FIXTURE password=SENSITIVE_FIXTURE KafkaJSSecretValue KAFKA_SECRET_VALUE');
  console.log('Kafka send failed [private-topic]: out of order sequence number; timed out; SENSITIVE_FIXTURE');
  console.log('Outbox drain failed: Code: 42501; SENSITIVE_FIXTURE');
} else process.exit(79);
`;
    fs.writeFileSync(path.join(bin, 'kubectl'), mock, { mode: 0o700 });
    const failedRuntime = path.join(f.cwd, 'failed-runtime.sh');
    fs.writeFileSync(failedRuntime, '#!/usr/bin/env bash\nexit 37\n');
    const executed = spawnSync('bash', ['-c', `set -Eeuo pipefail\n${suffix}`], {
      cwd: f.cwd,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, EXACT_HEAD: head,
        EVIDENCE_DIR: path.join(f.cwd, 'artifacts/industrial-readiness'), NAMESPACE: 'test',
        GENERATED_SCRIPT: failedRuntime, postgres_password: 'SENSITIVE_FIXTURE',
        DIAGNOSTIC_FAILURE: diagnosticFailure ? '1' : '0', SQL_AUDIT: path.join(f.cwd, 'sql.txt') },
      encoding: 'utf8', timeout: 10000,
    });
    assert.equal(executed.status, 37, executed.stderr);
    assert.equal(fs.readFileSync(path.join(f.dir, 'outbox-worker-runtime-acceptance.json'), 'utf8'), reportBefore);
    assert.doesNotMatch(executed.stdout + executed.stderr, /SENSITIVE_FIXTURE/u);
    const events = fs.readFileSync(path.join(f.dir, 'failure-worker-events.jsonl'), 'utf8');
    const workers = fs.readFileSync(path.join(f.dir, 'failure-worker-state.json'), 'utf8');
    assert.doesNotMatch(events + workers, /SENSITIVE_FIXTURE|KafkaJSSecretValue|KAFKA_SECRET_VALUE|private-topic/u);
    if (!diagnosticFailure) {
      assert.match(events, /delivered=20/u);
      assert.match(events, /P2024/u);
      assert.match(events, /kafka-send-failed/u);
      assert.match(events, /sequence-order-error/u);
      assert.match(events, /timeout/u);
      assert.match(events, /sql-permission/u);
      assert.equal(JSON.parse(workers).workers[0].containers[0].restartCount, 2);
      const sql = fs.readFileSync(path.join(f.cwd, 'sql.txt'), 'utf8');
      assert.ok(sql.includes(`LIKE '${runId}.%'`));
      assert.doesNotMatch(sql, /"payload"|"leaseToken"|"lastError"/u);
    }
  });
}
