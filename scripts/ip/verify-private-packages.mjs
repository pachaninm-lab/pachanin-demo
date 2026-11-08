import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const baselineMode = process.argv.includes('--baseline');
const publishablePath = join(root, 'docs/ip/publishable-packages.json');
if (existsSync(publishablePath) && !lstatSync(publishablePath).isFile()) {
  throw new Error(`${publishablePath}: publishable-package register must be a regular file`);
}
const publishableDocument = existsSync(publishablePath)
  ? JSON.parse(readFileSync(publishablePath, 'utf8'))
  : [];
if (!Array.isArray(publishableDocument) || publishableDocument.some((name) => typeof name !== 'string' || !name.trim())) {
  throw new Error(`${publishablePath}: expected an array of non-empty package names`);
}
const publishable = new Set(publishableDocument);
const exceptionsPath = join(root, 'docs/ip/internal-package-metadata-exceptions.json');
if (existsSync(exceptionsPath) && !lstatSync(exceptionsPath).isFile()) {
  throw new Error(`${exceptionsPath}: exception register must be a regular file`);
}
const exceptionDocument = existsSync(exceptionsPath)
  ? JSON.parse(readFileSync(exceptionsPath, 'utf8'))
  : { exceptions: [] };
if (!Array.isArray(exceptionDocument.exceptions)) {
  throw new Error(`${exceptionsPath}: exceptions must be an array`);
}
const exceptionPaths = exceptionDocument.exceptions.map((item) => item.path);
if (new Set(exceptionPaths).size !== exceptionPaths.length) {
  throw new Error(`${exceptionsPath}: duplicate exception paths are forbidden`);
}
const exceptions = new Map(
  (exceptionDocument.exceptions ?? []).map((item) => [item.path, item]),
);

const manifests = ['package.json'];
for (const directory of ['apps', 'packages']) {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) continue;
  if (!lstatSync(absolute).isDirectory()) throw new Error(`${directory}: package discovery root must be a real directory`);
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const rel = `${directory}/${entry.name}/package.json`;
    if (existsSync(join(root, rel))) manifests.push(rel);
  }
}

const failures = [];
const openRemainders = [];
const seenExceptions = new Set();
if (publishable.size) {
  failures.push(`INTERNAL_PUBLISHABLE_PACKAGES must be 0; remove: ${[...publishable].sort().join(', ')}`);
}
for (const rel of manifests.sort()) {
  const absolute = join(root, rel);
  if (!lstatSync(absolute).isFile()) {
    failures.push(`${rel}: internal manifest must be a regular file, not a symlink or special file`);
    continue;
  }
  const manifest = JSON.parse(readFileSync(absolute, 'utf8'));
  const name = manifest.name ?? rel;

  const exception = exceptions.get(rel);
  if (exception) {
    seenExceptions.add(rel);
    if (exception.name !== name || exception.status !== 'OPEN_BLOCKER') {
      failures.push(`${rel}: malformed or stale metadata exception`);
      continue;
    }
    if (!exception.reason || !exception.authority || !exception.expiresOn) {
      failures.push(`${rel}: exception must record reason, authority and expiresOn`);
      continue;
    }
    const expiresAt = /^\d{4}-\d{2}-\d{2}$/u.test(exception.expiresOn)
      ? Date.parse(`${exception.expiresOn}T23:59:59Z`)
      : Number.NaN;
    const normalizedExpiry = Number.isFinite(expiresAt) ? new Date(expiresAt).toISOString().slice(0, 10) : '';
    if (!Number.isFinite(expiresAt) || normalizedExpiry !== exception.expiresOn) {
      failures.push(`${rel}: exception expiresOn must be a real YYYY-MM-DD date`);
      continue;
    }
    if (expiresAt < Date.now()) {
      failures.push(`${rel}: metadata exception expired on ${exception.expiresOn}`);
      continue;
    }
  }

  if (manifest.private !== true) {
    failures.push(`${rel}: ${name} must set "private": true`);
  }
  if (manifest.license !== 'UNLICENSED') {
    if (exception && exception.missingField === 'license=UNLICENSED') {
      openRemainders.push(`${rel}: ${exception.missingField} (${exception.authority})`);
    } else {
      failures.push(`${rel}: ${name} must set "license": "UNLICENSED"`);
    }
  } else if (exception) {
    failures.push(`${rel}: metadata exception is stale because the manifest is compliant`);
  }
}

for (const rel of exceptions.keys()) {
  if (!seenExceptions.has(rel)) failures.push(`${rel}: exception does not match a discovered internal manifest`);
}

if (!baselineMode && openRemainders.length) {
  for (const remainder of openRemainders) failures.push(`final mode blocks open remainder: ${remainder}`);
}

if (failures.length) {
  console.error('IP package publication guard FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const suffix = openRemainders.length
  ? `; ${openRemainders.length} explicit final-state blocker(s): ${openRemainders.join('; ')}`
  : '';
console.log(`IP package publication guard PASS_${baselineMode ? 'BASELINE' : 'FINAL'} (${manifests.length} manifests checked${suffix})`);
