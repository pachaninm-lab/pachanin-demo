import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'docs/TASK_14_PROBLEM_HARDENING.md',
  'packages/domain-core/src/problem-closure-matrix.ts',
  'packages/domain-core/src/provider-compliance-gates.ts',
  'packages/domain-core/src/document-correction-workflow.ts',
  'packages/domain-core/src/browser-access-policy.ts',
  'packages/domain-core/src/integration-hardening.ts',
  'packages/domain-core/src/unified-deal-passport.ts'
];

const checks = requiredFiles.map((file) => ({ file, exists: fs.existsSync(path.join(root, file)) }));
const indexBody = fs.readFileSync(path.join(root, 'packages/domain-core/src/index.ts'), 'utf8');
const exported = [
  'problem-closure-matrix',
  'provider-compliance-gates',
  'document-correction-workflow',
  'browser-access-policy',
  'integration-hardening',
  'unified-deal-passport'
].every((token) => indexBody.includes(token));

const matrixBody = fs.readFileSync(path.join(root, 'packages/domain-core/src/problem-closure-matrix.ts'), 'utf8');
const numbers = Array.from(matrixBody.matchAll(/\bno:\s*(\d+)/g)).map((m) => Number(m[1]));
const expected = [3, 5, 7, 8, 10, 14, 15, 17, 18, 19, 20, 21, 23, 25];
const missing = expected.filter((value) => !numbers.includes(value));

const report = {
  generatedAt: new Date().toISOString(),
  pass: checks.every((item) => item.exists) && exported && missing.length === 0,
  files: checks,
  exportsPresent: exported,
  expectedProblems: expected,
  missingProblems: missing
};

fs.mkdirSync(path.join(root, 'var'), { recursive: true });
fs.writeFileSync(path.join(root, 'var/problem-14-hardening-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
