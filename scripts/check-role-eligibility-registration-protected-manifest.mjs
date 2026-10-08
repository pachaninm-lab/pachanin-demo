#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const manifestPath = 'config/eligibility/registration-protected-manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const baseline = String(manifest.baselineSha || '');
if (!/^[0-9a-f]{40}$/.test(baseline)) throw new Error('ROLE_ELIGIBILITY_PROTECTED_BASELINE_INVALID');
if (!Array.isArray(manifest.paths) || manifest.paths.length === 0) throw new Error('ROLE_ELIGIBILITY_PROTECTED_PATHS_EMPTY');

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
try {
  git('cat-file', '-e', `${baseline}^{commit}`);
} catch {
  throw new Error('ROLE_ELIGIBILITY_PROTECTED_BASELINE_NOT_FETCHED');
}

const failures = [];
const proof = [];
for (const path of manifest.paths) {
  if (typeof path !== 'string' || !path || path.includes('..')) {
    failures.push(`INVALID_PATH:${String(path)}`);
    continue;
  }
  let baselineBlob;
  let currentBlob;
  try { baselineBlob = git('rev-parse', `${baseline}:${path}`); } catch { failures.push(`BASELINE_MISSING:${path}`); continue; }
  try { currentBlob = git('rev-parse', `HEAD:${path}`); } catch { failures.push(`CURRENT_MISSING:${path}`); continue; }
  proof.push({ path, baselineBlob, currentBlob, equal: baselineBlob === currentBlob });
  if (baselineBlob !== currentBlob) failures.push(`CHANGED:${path}`);
}

const result = {
  baselineSha: baseline,
  headSha: git('rev-parse', 'HEAD'),
  registrationCodeChanged: failures.length > 0,
  protectedPathCount: manifest.paths.length,
  failures,
  proof,
};
fs.mkdirSync('artifacts/role-eligibility', { recursive: true });
fs.writeFileSync('artifacts/role-eligibility/registration-protected.json', `${JSON.stringify(result, null, 2)}\n`);

if (failures.length > 0) {
  console.error('REGISTRATION_CODE_CHANGED=1');
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log('REGISTRATION_CODE_CHANGED=0');
console.log(`REGISTRATION_PROTECTED_PATHS=${manifest.paths.length}`);
