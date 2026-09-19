import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const evidenceDir = process.env.EVIDENCE_DIR ?? 'artifacts/pc-crop-08h';
const required = [
  'scope-guard.ok',
  'schema-authority.ok',
  'migration.ok',
  'database-authority.ok',
  'typecheck.ok',
  'unit-tests.ok',
  'postgresql-acceptance.ok',
];
const missing = required.filter((name) => !fs.existsSync(path.join(evidenceDir, name)));
const exactHeadPath = path.join(evidenceDir, 'exact-head.txt');
const exactHead = fs.existsSync(exactHeadPath)
  ? fs.readFileSync(exactHeadPath, 'utf8').trim()
  : '';
const changedFilesPath = path.join(evidenceDir, 'changed-files.txt');
const changedFiles = fs.existsSync(changedFilesPath)
  ? fs.readFileSync(changedFilesPath, 'utf8').split('\n').filter(Boolean)
  : [];
const report = {
  schemaVersion: 'pc-crop.fgis-grain-exchange-acceptance.v1',
  slice: 'PC-CROP-08H',
  issue: 3278,
  exactHead,
  operationalStatus: 'NOT_ATTESTED',
  productionHosting: 'REG_RU_VPS_ONLY',
  liveProviderCall: false,
  secondInboxOrOutbox: false,
  directDomainMutation: false,
  changedFiles,
  requiredEvidence: required,
  missingEvidence: missing,
  status: exactHead && missing.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString(),
};
fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(
  path.join(evidenceDir, 'pc-crop-08h-acceptance.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
if (report.status !== 'PASS') {
  process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(1);
}
