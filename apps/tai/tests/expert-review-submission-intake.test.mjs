#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildExpertReviewPacket,
  materializeExpertReviewPacket,
} from '../model-artifacts/expert-review-packet.mjs';
import { ingestExpertReviewSubmission } from '../model-artifacts/expert-review-submission-intake.mjs';
import {
  buildCorpus,
  sha256,
  validateCorpus,
  validateReviews,
} from '../../../docs/platform-v7/autopilot/tai-ap-14c/gold-set-authority.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_REVIEWS = resolve(
  HERE,
  '../../../docs/platform-v7/autopilot/tai-ap-14c/expert-reviews.v1.json',
);
const EXACT_MAIN = 'a'.repeat(40);
const GENERATED_AT = '2026-07-21T10:00:00Z';
const SUBMITTED_AT = '2026-07-21T10:20:00Z';
const EVALUATED_AT = SUBMITTED_AT;

function json(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function digest(label) {
  return createHash('sha256').update(`external-evidence:${label}`).digest('hex');
}

function resign(review) {
  const payload = { ...review };
  delete payload.review_sha256;
  review.review_sha256 = sha256(payload);
  return review;
}

function record(caseValue, role, reviewer, suffix = '01') {
  return resign({
    review_id: `review-${caseValue.case_id.replaceAll('.', '-')}-${suffix}`,
    case_id: caseValue.case_id,
    case_sha256: caseValue.case_sha256,
    reviewer_id: reviewer,
    reviewer_role: role,
    decision: 'APPROVED',
    reviewed_at: '2026-07-21T10:10:00Z',
    evidence_sha256: digest(`${caseValue.case_id}:${role}:${reviewer}:${suffix}`),
    disagreement_with_review_id: null,
    review_sha256: '',
  });
}

function envelope(packet, trackId, reviews) {
  return {
    schema_version: 'tai.expert-review-submission.v1',
    exact_main_sha: packet.exact_main_sha,
    corpus_sha256: packet.corpus_sha256,
    packet_sha256: packet.packet_sha256,
    track_id: trackId,
    submitter_id: 'review-coordinator-01',
    submitted_at: SUBMITTED_AT,
    reviews,
  };
}

function fixture(existing = null, generatedAt = GENERATED_AT) {
  const root = mkdtempSync(resolve(tmpdir(), 'tai-review-intake-'));
  const existingReviewsPath = resolve(root, 'existing-reviews.json');
  writeJson(existingReviewsPath, existing ?? json(REPO_REVIEWS));
  const packetDirectory = resolve(root, 'packet');
  const packet = buildExpertReviewPacket({
    exactMainSha: EXACT_MAIN,
    generatedAt,
    reviewsPath: existingReviewsPath,
  });
  materializeExpertReviewPacket(packet, packetDirectory);
  return {
    root,
    packet,
    existingReviewsPath,
    packetPath: resolve(packetDirectory, 'expert-review-packet.v1.json'),
    submissionPath: resolve(root, 'submission.json'),
    outputReviewsPath: resolve(root, 'candidate-reviews.json'),
    outputAssessmentPath: resolve(root, 'candidate-assessment.json'),
    outputReportPath: resolve(root, 'candidate-report.json'),
  };
}

function run(input, overrides = {}) {
  return ingestExpertReviewSubmission({
    ...input,
    exactMainSha: EXACT_MAIN,
    expectedPacketSha256: input.packet.packet_sha256,
    evaluatedAt: EVALUATED_AT,
    ...overrides,
  });
}

function useFixture(existing, callback, generatedAt = GENERATED_AT) {
  const input = fixture(existing, generatedAt);
  try {
    callback(input);
  } finally {
    rmSync(input.root, { recursive: true, force: true });
  }
}

function normalPlatform(packet) {
  const value = packet.cases.find(
    (item) => item.domain === 'PLATFORM' && item.criticality !== 'CRITICAL',
  );
  assert.ok(value);
  return value;
}

useFixture(null, (input) => {
  const review = record(normalPlatform(input.packet), 'PLATFORM_OWNER', 'platform-owner-01');
  writeJson(input.submissionPath, envelope(input.packet, 'platform-primary', [review]));
  const report = run(input);
  assert.equal(report.status, 'CANDIDATE_WRITTEN_FOR_HUMAN_PR_REVIEW');
  assert.equal(report.reviews_added, 1);
  assert.equal(report.automation_created_decisions, false);
  assert.equal(report.candidate_assessment_status, 'PENDING_REVIEW');
  assert.match(report.packet_file_sha256, /^[0-9a-f]{64}$/);
  assert.equal(json(input.outputReviewsPath).reviews.length, 1);
  assert.equal(json(input.outputAssessmentPath).counts.reviewed_cases, 1);
});

useFixture(null, (input) => {
  const critical = input.packet.cases.find((item) => item.criticality === 'CRITICAL');
  assert.ok(critical);
  const review = record(critical, 'SECURITY_REVIEWER', 'security-reviewer-01');
  writeJson(input.submissionPath, envelope(input.packet, 'critical-security', [review]));
  const report = run(input);
  assert.equal(report.reviews_added, 1);
  assert.equal(report.candidate_accepted, false);
  assert.equal(json(input.outputAssessmentPath).counts.reviewed_cases, 0);
});

const mutations = [
  [
    /stale case digest/,
    (review) => {
      review.case_sha256 = 'f'.repeat(64);
      resign(review);
    },
  ],
  [
    /reviewer role does not match track/,
    (review) => {
      review.reviewer_role = 'DOMAIN_EXPERT';
      resign(review);
    },
  ],
  [
    /review is after submission/,
    (review) => {
      review.reviewed_at = '2026-07-21T10:21:00Z';
      resign(review);
    },
  ],
  [
    /non-placeholder SHA-256/,
    (review) => {
      review.evidence_sha256 = 'e'.repeat(64);
      resign(review);
    },
  ],
  [
    /keys invalid/,
    (review) => {
      review.unknown = true;
    },
  ],
];

for (const [expected, mutate] of mutations) {
  useFixture(null, (input) => {
    const review = record(normalPlatform(input.packet), 'PLATFORM_OWNER', 'platform-owner-01');
    mutate(review);
    writeJson(input.submissionPath, envelope(input.packet, 'platform-primary', [review]));
    assert.throws(() => run(input), expected);
  });
}

useFixture(null, (input) => {
  const cases = input.packet.cases.filter(
    (item) => item.domain === 'PLATFORM' && item.criticality !== 'CRITICAL',
  );
  const first = record(cases[0], 'PLATFORM_OWNER', 'platform-owner-01');
  const second = record(cases[1], 'PLATFORM_OWNER', 'platform-owner-02');
  second.review_id = first.review_id;
  resign(second);
  writeJson(input.submissionPath, envelope(input.packet, 'platform-primary', [first, second]));
  assert.throws(() => run(input), /duplicate review ID in submission/);
});

{
  const corpus = buildCorpus();
  const caseMap = validateCorpus(corpus);
  const caseValue = [...caseMap.values()].find(
    (item) => item.domain === 'PLATFORM' && item.criticality !== 'CRITICAL',
  );
  assert.ok(caseValue);
  const existing = json(REPO_REVIEWS);
  existing.reviews = [
    record(caseValue, 'PLATFORM_OWNER', 'platform-owner-existing', 'existing'),
  ];
  validateReviews(existing, caseMap);
  useFixture(existing, (input) => {
    const replacement = record(
      caseValue,
      'PLATFORM_OWNER',
      'platform-owner-existing',
      'replacement',
    );
    writeJson(input.submissionPath, envelope(input.packet, 'platform-primary', [replacement]));
    assert.throws(() => run(input), /reviewer\/case pair already exists/);
  });
}

useFixture(null, (input) => {
  const review = record(normalPlatform(input.packet), 'PLATFORM_OWNER', 'platform-owner-01');
  const value = envelope(input.packet, 'platform-primary', [review]);
  value.packet_sha256 = '0'.repeat(64);
  writeJson(input.submissionPath, value);
  assert.throws(() => run(input), /submission packet mismatch/);
});

useFixture(null, (input) => {
  const review = record(normalPlatform(input.packet), 'PLATFORM_OWNER', 'platform-owner-01');
  writeJson(input.submissionPath, envelope(input.packet, 'platform-primary', [review]));
  assert.throws(
    () => run(input, { expectedPacketSha256: '0'.repeat(64) }),
    /trusted digest/,
  );
});

useFixture(null, (input) => {
  const review = record(normalPlatform(input.packet), 'PLATFORM_OWNER', 'platform-owner-01');
  const value = envelope(input.packet, 'platform-primary', [review]);
  const compact = JSON.stringify(value);
  const duplicate = compact.replace(
    '"track_id":"platform-primary"',
    '"track_id":"platform-primary","track_id":"agro-primary"',
  );
  writeFileSync(input.submissionPath, duplicate, 'utf8');
  assert.throws(() => run(input), /duplicate JSON key "track_id"/);
});

useFixture(null, (input) => {
  const review = record(normalPlatform(input.packet), 'PLATFORM_OWNER', 'platform-owner-01');
  review.reviewed_at = '2026-02-30T10:10:00Z';
  resign(review);
  writeJson(input.submissionPath, envelope(input.packet, 'platform-primary', [review]));
  assert.throws(() => run(input), /day is invalid/);
});

useFixture(
  null,
  (input) => {
    const review = record(normalPlatform(input.packet), 'PLATFORM_OWNER', 'platform-owner-01');
    const value = envelope(input.packet, 'platform-primary', [review]);
    value.submitted_at = '2026-07-21T10:22:00Z';
    writeJson(input.submissionPath, value);
    assert.throws(() => run(input), /packet generation timestamp is in the future/);
  },
  '2026-07-21T10:21:00Z',
);

useFixture(null, (input) => {
  const review = record(normalPlatform(input.packet), 'PLATFORM_OWNER', 'platform-owner-01');
  writeJson(input.submissionPath, envelope(input.packet, 'platform-primary', [review]));
  assert.throws(
    () => run(input, { outputReviewsPath: input.existingReviewsPath }),
    /output path must not overlap an input/,
  );
  assert.equal(existsSync(input.outputAssessmentPath), false);
  assert.equal(existsSync(input.outputReportPath), false);
});

useFixture(null, (input) => {
  const review = record(normalPlatform(input.packet), 'PLATFORM_OWNER', 'platform-owner-01');
  writeJson(input.submissionPath, envelope(input.packet, 'platform-primary', [review]));
  assert.throws(
    () => run(input, { outputAssessmentPath: input.outputReviewsPath }),
    /canonically distinct/,
  );
  assert.equal(existsSync(input.outputReviewsPath), false);
  assert.equal(existsSync(input.outputReportPath), false);
});

useFixture(null, (input) => {
  const review = record(normalPlatform(input.packet), 'PLATFORM_OWNER', 'platform-owner-01');
  writeJson(input.submissionPath, envelope(input.packet, 'platform-primary', [review]));
  const symlinkTarget = resolve(input.root, 'symlink-target.json');
  writeFileSync(symlinkTarget, '{}\n', 'utf8');
  symlinkSync(symlinkTarget, input.outputAssessmentPath);
  assert.throws(() => run(input), /must not be a symbolic link/);
  assert.equal(existsSync(input.outputReviewsPath), false);
  assert.equal(existsSync(input.outputReportPath), false);
});

process.stdout.write('expert review submission intake tests: PASS\n');
