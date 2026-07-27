import { readFileSync, writeFileSync } from 'node:fs';

const file = 'scripts/pc-crop-3290/materialize.mjs';
let source = readFileSync(file, 'utf8');

function replaceExact(needle, replacement, expected = 1) {
  const count = source.split(needle).length - 1;
  if (count !== expected) throw new Error(`prepatch mismatch for ${needle.slice(0, 80)}: ${count}`);
  source = source.replaceAll(needle, replacement);
}

replaceExact("  h: '.github/workflows/pc-crop-08h.yml',\n", '');
replaceExact(
  "  requireCount(triggers.h, path, 2, \\\`08H successor ownership for \\\${path}\\\`);\n",
  '',
  2,
);
replaceExact("requireCount(tails.h, 'fgis-grain-outbox-dispatch.handler.spec.ts', 1, '08H transferred dispatch unit regression present');\n", '');
replaceExact("requireCount(tails.h, 'test/industrial/fgis-grain-dispatch.e2e-spec.ts', 1, '08H transferred dispatch PostgreSQL regression present');\n", '');
replaceExact(
  "const projectionShared = ${JSON.stringify(projectionShared, null, 2)};\n",
  "const projectionShared = ${JSON.stringify(projectionShared, null, 2)};\nconst handoff = JSON.parse(readFileSync('docs/platform-v7/autopilot/scopes/pc-crop-successor-trigger-handoff-3290.json', 'utf8')).handoffs || {};\nif (handoff.successorWorkflow !== '.github/workflows/pc-crop-08h.yml') throw new Error('successor workflow handoff is not pinned to PC-CROP-08H');\nif (JSON.stringify(handoff.dispatchShared) !== JSON.stringify(dispatchShared)) throw new Error('dispatch handoff registry drift');\nif (JSON.stringify(handoff.projectionShared) !== JSON.stringify(projectionShared)) throw new Error('projection handoff registry drift');\n",
);
replaceExact('dispatchSharedPathsOwnedBy08H: true,', 'dispatchSharedPathsReservedFor08H: true,');
replaceExact('projectionSharedPathsOwnedBy08H: true,', 'projectionSharedPathsReservedFor08H: true,');
replaceExact(
  "  operationalStatus: 'NOT_ATTESTED',\n  allowedPaths:",
  "  operationalStatus: 'NOT_ATTESTED',\n  handoffs: {\n    successorWorkflow: '.github/workflows/pc-crop-08h.yml',\n    dispatchShared,\n    projectionShared,\n  },\n  allowedPaths:",
);

writeFileSync(file, source, 'utf8');
