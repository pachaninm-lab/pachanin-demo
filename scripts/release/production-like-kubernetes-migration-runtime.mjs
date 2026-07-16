#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const evidenceDir = process.env.EVIDENCE_DIR || 'artifacts/industrial-readiness';
const manifestPath = path.join(evidenceDir, 'kubernetes', 'rendered', 'initial-migration.yaml');

if (!fs.existsSync(manifestPath)) {
  throw new Error(`Missing rendered migration manifest: ${manifestPath}`);
}

const source = fs.readFileSync(manifestPath, 'utf8');
const marker = `            - name: RUNTIME_COMPONENT\n              value: migration-job\n`;
const replacement = `${marker}            - name: HOME\n              value: /tmp\n            - name: TMPDIR\n              value: /tmp\n            - name: XDG_CACHE_HOME\n              value: /tmp/.cache\n            - name: npm_config_cache\n              value: /tmp/.npm\n            - name: PRISMA_HIDE_UPDATE_MESSAGE\n              value: "true"\n`;

const occurrences = source.split(marker).length - 1;
if (occurrences !== 1) {
  throw new Error(`Expected exactly one migration runtime marker, found ${occurrences}`);
}

const patched = source.replace(marker, replacement);
if (!patched.includes('readOnlyRootFilesystem: true')) {
  throw new Error('Migration manifest lost readOnlyRootFilesystem enforcement');
}
if (!patched.includes('mountPath: /tmp')) {
  throw new Error('Migration manifest has no writable /tmp mount');
}

fs.writeFileSync(manifestPath, patched);
fs.writeFileSync(
  path.join(evidenceDir, 'kubernetes', 'rendered', 'migration-runtime-hardening.json'),
  `${JSON.stringify({
    schemaVersion: 1,
    readOnlyRootFilesystem: true,
    writableRuntimePath: '/tmp',
    redirectedVariables: ['HOME', 'TMPDIR', 'XDG_CACHE_HOME', 'npm_config_cache'],
    prismaUpdateMessageDisabled: true,
  }, null, 2)}\n`,
);
