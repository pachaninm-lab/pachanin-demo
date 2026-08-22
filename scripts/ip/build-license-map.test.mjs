import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('internal classification requires exact SrcFile manifest evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'pc-license-map-'));
  const sbomDir = join(root, 'sbom');
  const outDir = join(root, 'out');
  const overridesPath = join(root, 'overrides.json');
  mkdirSync(sbomDir);
  mkdirSync(outDir);
  writeFileSync(overridesPath, '{"schemaVersion":1,"overrides":[]}\n');
  writeFileSync(join(sbomDir, 'sbom-node.cdx.json'), JSON.stringify({
    bomFormat: 'CycloneDX',
    components: [
      { name: '@pc/untrusted-prefix', version: '1.0.0', purl: 'pkg:npm/%40pc/untrusted-prefix@1.0.0', licenses: [] },
      { name: 'transparent-agro-intelligence', version: '0.1.0', purl: 'pkg:pypi/transparent-agro-intelligence@0.1.0', licenses: [] },
      {
        name: 'transparent-agro-intelligence',
        version: '0.1.0',
        purl: 'pkg:pypi/transparent-agro-intelligence@0.1.0',
        licenses: [],
        properties: [{ name: 'SrcFile', value: 'apps/tai/pyproject.toml' }],
      },
      { name: 'permissive-example', version: '1.0.0', purl: 'pkg:npm/permissive-example@1.0.0', licenses: [{ expression: 'MIT AND Zlib' }] },
    ],
  }));

  execFileSync(process.execPath, [
    'scripts/ip/build-license-map.mjs', sbomDir, outDir, overridesPath,
  ], { cwd: process.cwd(), stdio: 'pipe' });

  const summary = JSON.parse(readFileSync(join(outDir, 'license-summary.json'), 'utf8'));
  assert.equal(summary.components, 4);
  assert.equal(summary.internalComponents, 1);
  assert.equal(summary.classifications.INTERNAL_PROPRIETARY, 1);
  assert.equal(summary.classifications.UNKNOWN_REVIEW, 2);
  assert.equal(summary.classifications.PERMISSIVE_OR_APPROVED, 1);

  const rows = readFileSync(join(outDir, 'license-map.csv'), 'utf8').split('\n');
  const prefixed = rows.find((row) => row.startsWith('@pc/untrusted-prefix,'));
  assert.match(prefixed ?? '', /,UNKNOWN_REVIEW,/u);
  const taiRows = rows.filter((row) => row.startsWith('transparent-agro-intelligence,'));
  assert.equal(taiRows.length, 2);
  assert.equal(taiRows.filter((row) => row.includes(',INTERNAL_PROPRIETARY,')).length, 1);
  assert.equal(taiRows.filter((row) => row.includes(',UNKNOWN_REVIEW,')).length, 1);
});
