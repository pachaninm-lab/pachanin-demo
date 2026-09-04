import fs from 'node:fs';
import path from 'node:path';

const exactHead = process.env.EXACT_HEAD || process.env.GITHUB_SHA || 'unknown';
const evidenceDir = process.env.EVIDENCE_DIR || 'artifacts/industrial-readiness/postgresql-ha';
const evidencePath = path.join(evidenceDir, 'postgresql-ha-acceptance.json');
const failurePath = path.join(evidenceDir, 'failure-reason.txt');

fs.mkdirSync(evidenceDir, { recursive: true });

if (!fs.existsSync(evidencePath)) {
  const failureReason = fs.existsSync(failurePath)
    ? fs.readFileSync(failurePath, 'utf8').trim()
    : 'acceptance script did not produce canonical evidence';
  const payload = {
    schemaVersion: 1,
    evidenceClass: 'POSTGRESQL_HA_FAILOVER_PITR',
    exactCommit: exactHead,
    environment: 'disposable-multi-node-kind',
    generatedAt: new Date().toISOString(),
    decision: 'FAIL',
    pass: false,
    failureReason,
    thresholds: {
      failoverRtoMs: 120000,
      committedRowsLost: 0,
      readyInstances: 3,
      synchronousStandbys: 1,
      restoreHashMismatch: 0,
      pitrBoundaryViolations: 0
    },
    violations: [failureReason],
    maturity: {
      acceptedLevel: 'NOT_ACCEPTED',
      prohibitedClaims: [
        'fully operational production',
        'real provider production history',
        'live external integrations'
      ]
    }
  };
  fs.writeFileSync(evidencePath, `${JSON.stringify(payload, null, 2)}\n`);
}
