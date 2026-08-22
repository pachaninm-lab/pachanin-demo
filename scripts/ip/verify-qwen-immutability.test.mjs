import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const SCRIPT = 'scripts/ip/verify-qwen-immutability.mjs';
const REVISION = '895c8d171bc03c30e113cd7a28c02494b5e068b7';
const HASH = 'a'.repeat(64);

function makeFixture({ boundary = {}, attestation = {}, record = {}, bundle = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'qwen-gate-'));
  mkdirSync(join(root, 'legal-reviews'), { recursive: true });

  const boundaryPath = join(root, 'boundary.json');
  writeFileSync(boundaryPath, JSON.stringify({
    foundationModelBoundary: {
      model: 'QWEN',
      classification: 'THIRD_PARTY_INFRASTRUCTURE',
      modification: 'NONE',
      finetune: 'NONE',
      lora: 'NONE',
      weightMutation: 'NONE',
      ...boundary,
    },
  }));

  writeFileSync(join(root, 'legal-reviews', 'qwen3-8b.review-attestation.v1.json'), JSON.stringify({
    model_id: 'Qwen/Qwen3-8B',
    revision: REVISION,
    decision: 'APPROVED',
    source_files_sha256: HASH,
    source_manifest_sha256: HASH,
    model_card_sha256: HASH,
    license_text_sha256: HASH,
    ...attestation,
  }));

  writeFileSync(join(root, 'legal-reviews', 'qwen3-8b.review-record.v1.json'), JSON.stringify({
    decision: 'APPROVED',
    license_spdx: 'Apache-2.0',
    reviewer_type: 'HUMAN',
    decision_basis: `reviewed Qwen/Qwen3-8B@${REVISION}`,
    ...record,
  }));

  writeFileSync(join(root, 'qwen3-8b.bundle.v2.pending.json'), JSON.stringify({
    lifecycle: 'PENDING_ACQUISITION',
    model_id: 'Qwen/Qwen3-8B',
    revision: REVISION,
    source_files: [],
    ...bundle,
  }));

  return { root, boundaryPath };
}

function run(fixture) {
  const result = spawnSync(process.execPath, [SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      QWEN_BOUNDARY_PATH: fixture.boundaryPath,
      QWEN_ARTIFACT_DIR: fixture.root,
    },
  });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

function withFixture(options, assertion) {
  const fixture = makeFixture(options);
  try {
    assertion(run(fixture));
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}

test('a consistent boundary and governance set passes', () => {
  withFixture({}, ({ status, out }) => {
    assert.equal(status, 0);
    assert.match(out, /QWEN_IMMUTABILITY: CONSISTENT/u);
  });
});

test('a pending bundle never reports pinned weights', () => {
  withFixture({}, ({ out }) => {
    assert.match(out, /pinned weights\s+false/u);
    assert.match(out, /PINNED_WEIGHTS=false/u);
  });
});

test('swapping the foundation model fails closed', () => {
  withFixture({ boundary: { model: 'LLAMA' } }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /foundation model changed/u);
  });
});

test('declaring any weight mutation fails closed', () => {
  for (const key of ['modification', 'finetune', 'lora', 'weightMutation']) {
    withFixture({ boundary: { [key]: 'APPLIED' } }, ({ status, out }) => {
      assert.equal(status, 1);
      assert.match(out, new RegExp(`boundary declares ${key}=APPLIED`, 'u'));
    });
  }
});

test('reclassifying Qwen as first-party fails closed', () => {
  withFixture({ boundary: { classification: 'FIRST_PARTY_PRODUCT' } }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /must stay THIRD_PARTY_INFRASTRUCTURE/u);
  });
});

test('a revision changed in only one artifact fails closed', () => {
  withFixture({ bundle: { revision: 'b'.repeat(40) } }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /revision disagrees across artifacts/u);
  });
});

test('a model swapped in only one artifact fails closed', () => {
  withFixture({ bundle: { model_id: 'Qwen/Qwen3-14B' } }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /model_id disagrees across artifacts/u);
  });
});

test('a withdrawn legal approval fails closed', () => {
  withFixture({ attestation: { decision: 'WITHDRAWN' } }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /attestation is not APPROVED/u);
  });
});

test('a missing licence fails closed', () => {
  withFixture({ record: { license_spdx: '   ' } }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /no license_spdx/u);
  });
});

test('a non-human legal review fails closed', () => {
  withFixture({ record: { reviewer_type: 'AI' } }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /must be human/u);
  });
});

test('an unpinned upstream hash fails closed', () => {
  withFixture({ attestation: { source_files_sha256: 'not-a-hash' } }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /source_files_sha256 is not a pinned sha256/u);
  });
});

test('an approval that does not cover the pinned revision fails closed', () => {
  withFixture({ record: { decision_basis: 'reviewed some other revision' } }, ({ status, out }) => {
    assert.equal(status, 1);
    assert.match(out, /does not appear in the legal decision basis/u);
  });
});
