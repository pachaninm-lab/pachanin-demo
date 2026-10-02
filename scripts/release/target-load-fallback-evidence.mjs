import fs from 'node:fs';
import path from 'node:path';

const exactHead = process.env.EXACT_HEAD || process.env.GITHUB_SHA || 'unknown';
const evidenceDir = process.env.EVIDENCE_DIR || 'artifacts/industrial-readiness/load';
const evidencePath = path.join(evidenceDir, 'target-load-acceptance.json');
const failurePath = path.join(evidenceDir, 'failure-reason.txt');
const junitPath = path.join(evidenceDir, 'target-load-acceptance.junit.xml');

fs.mkdirSync(evidenceDir, { recursive: true });
const failureReason = fs.existsSync(failurePath)
  ? fs.readFileSync(failurePath, 'utf8').trim()
  : 'target-load acceptance did not produce canonical evidence';
if (!fs.existsSync(evidencePath)) {
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

if (!fs.existsSync(junitPath)) {
  const xmlEscape = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
  fs.writeFileSync(junitPath, [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<testsuite name="target-load-and-burst-acceptance" tests="1" failures="1" time="0">',
    '  <testcase classname="industrial-readiness.load" name="acceptance-incomplete">',
    `    <failure message="ACCEPTANCE_INCOMPLETE">${xmlEscape(failureReason)}</failure>`,
    '  </testcase>',
    '</testsuite>',
    '',
  ].join('\n'));
}
