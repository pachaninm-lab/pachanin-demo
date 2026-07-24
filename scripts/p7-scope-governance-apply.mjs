#!/usr/bin/env node
import fs from 'node:fs';

const file = 'scripts/p7-autopilot-guard.sh';
const source = fs.readFileSync(file, 'utf8');
const invocation = 'SOURCE_CONTROLLED_SCOPE=$(GITHUB_HEAD_REF="${GITHUB_HEAD_REF:-}" node scripts/p7-source-controlled-scope.mjs)';

if (source.includes(invocation)) {
  console.log('p7 scope auto-discovery already applied');
  process.exit(0);
}

const startMarker = 'SOURCE_CONTROLLED_SCOPE=$(GITHUB_HEAD_REF="${GITHUB_HEAD_REF:-}" node - <<\'JS\'';
const endMarker = '\nif [ -n "$SOURCE_CONTROLLED_SCOPE" ]; then';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0 || end <= start) {
  throw new Error('Cannot locate the legacy source-controlled scope registry');
}
const legacy = source.slice(start, end);
if (!legacy.includes('const manifests = {') || !legacy.includes('const path = manifests[branch];')) {
  throw new Error('Legacy registry shape changed; refusing an ambiguous migration');
}
const updated = `${source.slice(0, start)}${invocation}\n${source.slice(end)}`;
if (updated.includes("'agent/pc-crop-08b-fgis-contract-catalog':")) {
  throw new Error('Hardcoded PC-CROP branch registry survived migration');
}
fs.writeFileSync(file, updated);
console.log('p7 source-controlled scope auto-discovery applied');
