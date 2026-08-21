import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const baselineMode = process.argv.includes('--baseline');
const publishablePath = join(root, 'docs/ip/publishable-packages.json');
const publishable = new Set(
  existsSync(publishablePath)
    ? JSON.parse(readFileSync(publishablePath, 'utf8'))
    : [],
);
const exceptionsPath = join(root, 'docs/ip/internal-package-metadata-exceptions.json');
const exceptionDocument = existsSync(exceptionsPath)
  ? JSON.parse(readFileSync(exceptionsPath, 'utf8'))
  : { exceptions: [] };
const exceptions = new Map(
  (exceptionDocument.exceptions ?? []).map((item) => [item.path, item]),
);

const manifests = ['package.json'];
for (const directory of ['apps', 'packages']) {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) continue;
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const rel = `${directory}/${entry.name}/package.json`;
    if (existsSync(join(root, rel))) manifests.push(rel);
  }
}

const failures = [];
const openRemainders = [];
const seenExceptions = new Set();
for (const rel of manifests.sort()) {
  const manifest = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  const name = manifest.name ?? rel;
  if (publishable.has(name)) continue;

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
    if (Date.parse(`${exception.expiresOn}T23:59:59Z`) < Date.now()) {
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
