#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sha256 } from './gold-set-authority.mjs';
import {
  buildExpertReviewPacket,
  materializeExpertReviewPacket,
} from './expert-review-packet.mjs';

const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = resolve(HERE, '../../../..');
const WORKFLOW = resolve(
  ROOT,
  '.github/workflows/tai-ap14c-expert-review-packet.yml',
);
const SCOPE = resolve(
  ROOT,
  'docs/platform-v7/autopilot/scopes/tai-ap-14c2-review-packet-2973.json',
);
const COMMAND = '/tai prepare expert-review-packet exact-main';
const EXACT_MAIN = 'a'.repeat(40);
const GENERATED_AT = '2026-07-21T15:00:00Z';

function json(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function packet() {
  return buildExpertReviewPacket({
    exactMainSha: EXACT_MAIN,
    generatedAt: GENERATED_AT,
  });
}

function testPacketIsExactAndDecisionFree() {
  const value = packet();
  assert.equal(value.schema_version, 'tai.expert-review-packet.v1');
  assert.equal(value.exact_main_sha, EXACT_MAIN);
  assert.equal(value.counts.total_cases, 58);
  assert.equal(value.counts.platform_cases, 42);
  assert.equal(value.counts.agro_cases, 16);
  assert.equal(value.counts.critical_cases, 23);
  assert.equal(value.counts.existing_reviews, 0);
  assert.equal(
    value.automation_boundary,
    'AUTOMATION_MUST_NOT_CREATE_REVIEW_DECISIONS',
  );
  assert.equal(value.maturity_boundary.expert_review_status, 'PENDING_REVIEW');
  assert.equal(
    value.maturity_boundary.benchmark_status,
    'PENDING_BENCHMARK',
  );
  assert.equal(
    value.maturity_boundary.model_admission_status,
    'PENDING_ADMISSION',
  );
  assert.equal(
    value.maturity_boundary.production_operational_status,
    'NOT_ATTESTED',
  );
  const payload = { ...value };
  delete payload.packet_sha256;
  assert.equal(value.packet_sha256, sha256(payload));
}

function testReviewerTracksAreCompleteAndNonOverclaiming() {
  const value = packet();
  const tracks = Object.fromEntries(
    value.reviewer_tracks.map((track) => [track.track_id, track]),
  );
  assert.equal(tracks['platform-primary'].case_count, 42);
  assert.equal(tracks['agro-primary'].case_count, 16);
  assert.equal(tracks['critical-security'].case_count, 23);
  assert.equal(tracks['critical-legal-method'].case_count, 23);
  assert.equal(new Set(value.cases.map((item) => item.case_id)).size, 58);
  for (const item of value.cases) {
    assert.match(item.case_sha256, /^[0-9a-f]{64}$/);
    assert.match(item.prompt_sha256, /^[0-9a-f]{64}$/);
    assert.ok(['PLATFORM', 'AGRO'].includes(item.domain));
    assert.ok(item.required_review.minimum_independent_approvals >= 1);
    if (item.criticality === 'CRITICAL') {
      assert.equal(item.required_review.minimum_independent_approvals, 2);
      assert.deepEqual(item.required_review.secondary_roles, [
        'LEGAL_OR_METHOD_REVIEWER',
        'SECURITY_REVIEWER',
      ]);
    }
  }
}

function testMaterializationIsBoundedAndTemplatesAreBlank() {
  const directory = mkdtempSync(join(tmpdir(), 'tai-expert-review-'));
  try {
    const value = packet();
    const manifest = materializeExpertReviewPacket(value, directory);
    assert.equal(
      manifest.schema_version,
      'tai.expert-review-packet-manifest.v1',
    );
    assert.equal(manifest.files.length, 6);
    assert.equal(manifest.packet_sha256, value.packet_sha256);
    assert.match(manifest.manifest_sha256, /^[0-9a-f]{64}$/);
    for (const file of manifest.files) {
      assert.match(file.sha256, /^[0-9a-f]{64}$/);
      assert.ok(file.size_bytes > 0 && file.size_bytes < 10_000_000);
    }
    const track = json(
      resolve(directory, 'track-critical-security.v1.json'),
    );
    assert.equal(track.review_templates.length, 23);
    for (const template of track.review_templates) {
      assert.equal(template.reviewer_role, 'SECURITY_REVIEWER');
      assert.equal(template.review_id, null);
      assert.equal(template.reviewer_id, null);
      assert.equal(template.decision, null);
      assert.equal(template.reviewed_at, null);
      assert.equal(template.evidence_sha256, null);
      assert.equal(template.review_sha256, null);
    }
    const submission = json(
      resolve(directory, 'review-submission-template.v1.json'),
    );
    assert.deepEqual(Object.keys(submission).sort(), [
      'policy',
      'reviews',
      'schema_version',
      'version',
    ]);
    assert.deepEqual(submission.reviews, []);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function testInvalidIdentityInputsFailClosed() {
  assert.throws(
    () =>
      buildExpertReviewPacket({
        exactMainSha: 'short',
        generatedAt: GENERATED_AT,
      }),
    /exact_main_sha/,
  );
  assert.throws(
    () =>
      buildExpertReviewPacket({
        exactMainSha: EXACT_MAIN,
        generatedAt: '2026-07-21T15:00:00',
      }),
    /timezone/,
  );
  const directory = mkdtempSync(join(tmpdir(), 'tai-expert-review-tamper-'));
  try {
    const value = packet();
    value.packet_sha256 = '0'.repeat(64);
    assert.throws(
      () => materializeExpertReviewPacket(value, directory),
      /packet digest mismatch/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function testWorkflowAndScopeRemainHumanOnly() {
  const workflow = readFileSync(WORKFLOW, 'utf8');
  assert.match(workflow, /github\.event\.issue\.number == 2973/);
  assert.ok(workflow.includes(`github.event.comment.body == '${COMMAND}'`));
  assert.ok(
    workflow.includes("github.event.comment.author_association == 'OWNER'"),
  );
  assert.ok(
    workflow.includes('AUTOMATION_MUST_NOT_CREATE_REVIEW_DECISIONS'),
  );
  assert.ok(workflow.includes('actions/upload-artifact@v4'));
  for (const forbidden of [
    'TAI_MODEL_SSH_',
    'TAI_BUNDLE_S3_',
    'PC_PROD_',
    'VPS_SSH_',
    'APPROVED_FOR_BENCHMARK',
    'production_operational_status: `ATTESTED`',
  ]) assert.ok(!workflow.includes(forbidden), forbidden);

  const scope = json(SCOPE);
  assert.equal(scope.schemaVersion, 'platform-v7-concurrent-scope.v1');
  assert.equal(scope.status, 'active');
  assert.equal(scope.parentIssue, 2788);
  assert.equal(scope.issue, 2973);
  assert.equal(scope.branch, 'agent/tai-ap-14c2-review-packet');
  assert.equal(
    scope.acceptance.at(-1),
    'production_operational_status remains NOT_ATTESTED',
  );
  assert.deepEqual(
    new Set(scope.allowedPaths),
    new Set([
      '.github/workflows/tai-ap14c-expert-review-packet.yml',
      'docs/platform-v7/autopilot/scopes/tai-ap-14c2-review-packet-2973.json',
      'docs/platform-v7/autopilot/tai-ap-14c/expert-review-packet.mjs',
      'docs/platform-v7/autopilot/tai-ap-14c/expert-review-packet.test.mjs',
      'docs/platform-v7/autopilot/tai-ap-14c/expert-review-packet-runbook.v1.md',
    ]),
  );
}

for (const test of [
  testPacketIsExactAndDecisionFree,
  testReviewerTracksAreCompleteAndNonOverclaiming,
  testMaterializationIsBoundedAndTemplatesAreBlank,
  testInvalidIdentityInputsFailClosed,
  testWorkflowAndScopeRemainHumanOnly,
]) test();

process.stdout.write('TAI AP-14C expert review packet tests: PASS\n');
