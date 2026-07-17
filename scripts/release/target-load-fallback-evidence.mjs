import fs from 'node:fs';
import path from 'node:path';

const exactHead = process.env.EXACT_HEAD || process.env.GITHUB_SHA || 'unknown';
const evidenceDir = process.env.EVIDENCE_DIR || 'artifacts/industrial-readiness/load';
const evidencePath = path.join(evidenceDir, 'target-load-acceptance.json');
const failurePath = path.join(evidenceDir, 'failure-reason.txt');

fs.mkdirSync(evidenceDir, { recursive: true });
if (!fs.existsSync(evidencePath)) {
  const failureReason = fs.existsSync(failurePath)
    ? fs.readFileSync(failurePath, 'utf8').trim()
    : 'target-load acceptance did not produce canonical evidence';
  fs.writeFileSync(evidencePath, `${JSON.stringify({
    schemaVersion: 1,
    evidenceClass: 'TARGET_LOAD_AND_BURST',
    exactCommit: exactHead,
    environment: 'production-like-multi-node-kind',
    generatedAt: new Date().toISOString(),
    decision: 'FAIL',
    pass: false,
    failureReason,
    violations: [{ code: 'ACCEPTANCE_INCOMPLETE', details: failureReason }],
    maturity: {
      acceptedLevel: 'NOT_ACCEPTED',
      prohibitedClaims: [
        'fully operational production',
        'real-provider production capacity',
        'live user behaviour',
        'live external integrations',
      ],
    },
  }, null, 2)}\n`);
}
