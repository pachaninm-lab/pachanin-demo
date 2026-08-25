import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '../../../../..');
const verifier = join(
  repositoryRoot,
  'scripts/verify-one-c-certification-readiness.mjs',
);
const readinessManifest = join(
  repositoryRoot,
  'docs/ops/pc-crop-federal-accounting/one-c-certification-readiness.v1.json',
);

describe('1C certification-readiness evidence', () => {
  it('passes the deterministic blocked-readiness gate', () => {
    const output = execFileSync(
      process.execPath,
      [verifier, '--root', repositoryRoot],
      { encoding: 'utf8' },
    );
    const report = JSON.parse(output) as {
      status: string;
      checked: Record<string, number>;
      facts: Record<string, boolean | number>;
      failures: string[];
    };

    expect(report.status).toBe('PASS');
    expect(report.failures).toEqual([]);
    expect(report.checked).toEqual({
      sourceHashes: 5,
      requirements: 54,
      acceptanceCases: 25,
      commands: 7,
      controlledScopePaths: 11,
    });
    expect(report.facts.certified).toBe(false);
    expect(report.facts.compiledCfePresent).toBe(false);
    expect(report.facts.productionConnected).toBe(false);
    expect(report.facts.newMandatoryCostRub).toBe(0);
  });

  it('fails closed when a source hash is tampered in the manifest', () => {
    const temporaryDirectory = mkdtempSync(
      join(tmpdir(), 'one-c-certification-readiness-'),
    );
    const tamperedManifest = join(temporaryDirectory, 'readiness.json');

    try {
      cpSync(readinessManifest, tamperedManifest);
      const value = JSON.parse(readFileSync(tamperedManifest, 'utf8')) as {
        sourceFiles: Array<{ sha256: string }>;
      };
      value.sourceFiles[0].sha256 = '0'.repeat(64);
      writeFileSync(tamperedManifest, `${JSON.stringify(value, null, 2)}\n`);

      const result = spawnSync(
        process.execPath,
        [
          verifier,
          '--root',
          repositoryRoot,
          '--manifest',
          tamperedManifest,
        ],
        { encoding: 'utf8' },
      );
      const report = JSON.parse(result.stdout) as {
        status: string;
        failures: string[];
      };

      expect(result.status).not.toBe(0);
      expect(report.status).toBe('FAIL');
      expect(report.failures).toContain(
        'manifest source hash drift: apps/api/src/modules/accounting/one-c-extension-source/TransparentPriceConfigurationAdapter.bsl',
      );
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
