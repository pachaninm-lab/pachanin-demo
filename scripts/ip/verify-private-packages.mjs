import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const publishablePath = join(root, 'docs/ip/publishable-packages.json');
const publishable = new Set(
  existsSync(publishablePath)
    ? JSON.parse(readFileSync(publishablePath, 'utf8'))
    : [],
);

const manifests = ['package.json', 'apps/api/package.json', 'apps/web/package.json'];
const packagesDir = join(root, 'packages');
if (existsSync(packagesDir)) {
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const rel = `packages/${entry.name}/package.json`;
    if (existsSync(join(root, rel))) manifests.push(rel);
  }
}

const failures = [];
for (const rel of manifests.sort()) {
  const manifest = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  const name = manifest.name ?? rel;
  if (publishable.has(name)) continue;

  if (manifest.private !== true) {
    failures.push(`${rel}: ${name} must set "private": true`);
  }
  if (manifest.license !== 'UNLICENSED') {
    failures.push(`${rel}: ${name} must set "license": "UNLICENSED"`);
  }
}

if (failures.length) {
  console.error('IP package publication guard FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`IP package publication guard PASS (${manifests.length} manifests checked)`);
