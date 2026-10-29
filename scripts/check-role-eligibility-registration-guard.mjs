import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const manifestPath = 'config/eligibility/registration-protected-manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const failures = [];
const hashes = [];

function git(...args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || `git ${args.join(' ')} failed`).trim());
  return String(result.stdout).trim();
}

if (!/^[0-9a-f]{40}$/.test(manifest.baselineSha)) failures.push('baseline SHA invalid');
if (!Array.isArray(manifest.paths) || !manifest.paths.length) failures.push('protected path list empty');
for (const path of manifest.paths || []) {
  try {
    const baselineBlob = git('rev-parse', `${manifest.baselineSha}:${path}`);
    const currentBlob = git('hash-object', '--', path);
    hashes.push({ path, baselineBlob, currentBlob, changed: baselineBlob !== currentBlob });
    if (baselineBlob !== currentBlob) failures.push(`${path}: protected blob changed`);
  } catch (error) {
    failures.push(`${path}: ${error.message}`);
  }
}

const changed = hashes.filter((item) => item.changed);
console.log(`REGISTRATION_BASELINE_SHA=${manifest.baselineSha}`);
console.log(`REGISTRATION_PROTECTED_PATHS=${hashes.length}`);
console.log(`REGISTRATION_CODE_CHANGED=${changed.length ? 1 : 0}`);
if (failures.length) {
  for (const failure of failures) console.error(`REGISTRATION_GUARD_ERROR=${failure}`);
  process.exit(1);
}
console.log('REGISTRATION_PROTECTED_MANIFEST=PASS');
