import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const script = 'scripts/ip/build-offline-similarity-evidence.mjs';

function run(outDir, env) {
  execFileSync(process.execPath, [script, outDir], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: 'pipe',
  });
  return JSON.parse(readFileSync(join(outDir, 'similarity-summary.json'), 'utf8'));
}

test('non-empty corpus requires exact approval evidence and short files do not share an empty structural signature', () => {
  const root = mkdtempSync(join(tmpdir(), 'pc-similarity-'));
  const corpus = join(root, 'corpus');
  mkdirSync(corpus);
  writeFileSync(join(corpus, 'external_sample.py'), [
    'def external_corpus_sentinel_20260821(value):',
    '    return value + "bounded-offline-corpus-test"',
    '',
  ].join('\n'));

  const pending = run(join(root, 'pending'), {
    IP_SIMILARITY_CORPUS: corpus,
    IP_SIMILARITY_CORPUS_APPROVED: '1',
    IP_SIMILARITY_CORPUS_APPROVAL: '',
  });
  assert.equal(pending.status, 'CORPUS_APPROVAL_REQUIRED');
  assert.equal(pending.corpusFiles, 1);
  assert.equal(pending.unresolvedFindings, 0);
  assert.match(pending.corpusDigestSha256, /^[0-9a-f]{64}$/u);

  const approval = join(root, 'approval.json');
  writeFileSync(approval, JSON.stringify({
    schemaVersion: 1,
    status: 'APPROVED',
    approvedAt: new Date().toISOString().slice(0, 10),
    authorityReference: 'LOCAL_TEST_ONLY',
    rightsBasis: 'SYNTHETIC_TEST_FIXTURE',
    scope: 'OFFLINE_SCANNER_ACCEPTANCE_TEST',
    corpusDigestSha256: pending.corpusDigestSha256,
  }));
  const approved = run(join(root, 'approved'), {
    IP_SIMILARITY_CORPUS: corpus,
    IP_SIMILARITY_CORPUS_APPROVED: '1',
    IP_SIMILARITY_CORPUS_APPROVAL: approval,
  });
  assert.equal(approved.status, 'NO_RELEVANT_MATCH');
  assert.equal(approved.finalEligible, true);
  assert.deepEqual(approved.finalBlockers, []);
});

test('empty and symlinked corpus roots fail closed', () => {
  const root = mkdtempSync(join(tmpdir(), 'pc-similarity-'));
  const empty = join(root, 'empty');
  mkdirSync(empty);
  const summary = run(join(root, 'empty-result'), {
    IP_SIMILARITY_CORPUS: empty,
    IP_SIMILARITY_CORPUS_APPROVED: '1',
    IP_SIMILARITY_CORPUS_APPROVAL: '',
  });
  assert.equal(summary.status, 'CORPUS_EMPTY');
  assert.equal(summary.finalEligible, false);
  assert(summary.finalBlockers.includes('APPROVED_OFFLINE_EXTERNAL_CORPUS_EMPTY'));

  const linked = join(root, 'linked-corpus');
  symlinkSync(empty, linked, 'dir');
  assert.throws(() => run(join(root, 'linked-result'), {
    IP_SIMILARITY_CORPUS: linked,
    IP_SIMILARITY_CORPUS_APPROVED: '1',
    IP_SIMILARITY_CORPUS_APPROVAL: '',
  }));
});
