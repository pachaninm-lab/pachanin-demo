#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
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
  computeAssessment,
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
const EVALUATED_AT = '2026-07-21T10:20:00Z';

function json(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function reviewRecord(caseValue, reviewerRole, reviewerId, suffix = '01') {
  const value = {
    review_id: `review-${caseValue.case_id.replaceAll('.', '-')}-${suffix}`,
    case_id: caseValue.case_id,
    case_sha256: caseValue.case_sha256,
    reviewer_id: reviewerId,
    reviewer_role: reviewerRole,
    decision: 'APPROVED',
    reviewed_at: '2026-07-21T10:10:00Z',
    evidence_sha256: 'e'.repeat(64),
    disagreement_with_review_id: null,
    review_sha256: '',
  };
  const payload = { ...value };
  delete payload.review_sha256;
  value.review_sha256 = sha256(payload);
  return value;
}

function resign(review) {
  const payload = { ...review };
  delete payload.review_sha256;
  review.review_sha256 = sha256(payload);
  return review;
}

function submission(packet, trackId, reviews) {
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

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'tai-review-intake-'));
  const packetDirectory = resolve(root, 'packet');
  const packet = buildExpertReviewPacket({
    exactMainSha: EXACT_MAIN,
    generatedAt: GENERATED_AT,
  });
  materializeExpertReviewPacket(packet, packetDirectory);
  const existingReviewsPath = resolve(root, 'existing-reviews.json');
  writeFileSync(existingReviewsPath, readFileSync(REPO_REVIEWS));
  return {
    root,
    packet,
    packetPath: resolve(packetDirectory, 'expert-review-packet.v1.json'),
    existingReviewsPath,
    outputReviewsPath: resolve(root, 'output/expert-reviews.v1.json'),
    outputAssessmentPath: resolve(root, 'output/baseline-assessment.v1.json'),
    outputReportPath: resolve(root, 'output/intake-report.v1.json'),
    submissionPath: resolve(root, 'submission.json'),
  };
}

function run(input) {
  return ingestExpertReviewSubmission({
    packetPath: input.packetPath,
    submissionPath: input.submissionPath,
    existingReviewsPath: input.existingReviewsPath,
    exactMainSha: EXACT_MAIN,
    evaluatedAt: EVALUATED_AT,
    outputReviewsPath: input.outputReviewsPath,
    outputAssessmentPath: input.outputAssessmentPath,
    outputReportPath: input.outputReportPath,
  });
}

function withFixture(callback) {
  const input = fixture();
  try {
    callback(input);
  } finally {
    rmSync(input.root, { recursive: true, force: true });
  }
}

withFixture((input) => {
  const normalPlatform = input.packet.cases.find(
    (item) => item.domain === 'PLATFORM' && item.criticality !== 'CRITICAL',
  );
  assert.ok(normalPlatform);
  const review = reviewRecord(normalPlatform, 'PLATFORM_OWNER', 'platform-owner-01');
  writeJson(input.submissionPath, submission(input.packet, 'platform-primary', [review]));
  const report = run(input);
  assert.equal(report.status, 'CANDIDATE_WRITTEN_FOR_HUMAN_PR_REVIEW');
  assert.equal(report.reviews_added, 1);
  assert.equal(report.automation_created_decisions, false);
  assert.equal(report.requires_human_pull_request_review, true);
  assert.equal(report.candidate_assessment_status, 'PENDING_REVIEW');
  assert.equal(json(input.outputReviewsPath).reviews.length, 1);
  assert.equal(json(input.outputAssessmentPath).counts.reviewed_cases, 1);
  assert.equal(json(input.outputReportPath).report_sha256, report.report_sha256);
});

withFixture((input) => {
  const critical = input.packet.cases.find((item) => item.criticality === 'CRITICAL');
  assert.ok(critical);
  const review = reviewRecord(critical, 'SECURITY_REVIEWER', 'security-reviewer-01');
  writeJson(input.submissionPath, submission(input.packet, 'critical-security', [review]));
  const report = run(input);
  assert.equal(report.reviews_added, 1);
  assert.equal(report.candidate_accepted, false);
  assert.equal(json(input.outputAssessmentPath).counts.reviewed_cases, 0);
});

const negativeCases = [
  {
    name: 'stale case digest',
    mutate(review) {
      review.case_sha256 = 'f'.repeat(64);
      resign(review);
    },
    expected: /stale case digest/,
  },
  {
    name: 'wrong track role',
    mutate(review) {
      review.reviewer_role = 'DOMAIN_EXPERT';
      resign(review);
    },
    expected: /reviewer role does not match track/,
  },
  {
    name: 'future review',
    mutate(review) {
      review.reviewed_at = '2026-07-21T10:21:00Z';
      resign(review);
    },
    expected: /review is after submission/,
  },
  {
    name: 'invalid evidence digest',
    mutate(review) {
      review.evidence_sha256 = 'invalid';
      resign(review);
    },
    expected: /evidence SHA-256 is invalid/,
  },
  {
    name: 'unknown review field',
    mutate(review) {
      review.unknown = true;
    },
    expected: /keys invalid/,
  },
];

for (const testCase of negativeCases) {
  withFixture((input) => {
    const caseValue = input.packet.cases.find(
      (item) => item.domain === 'PLATFORM' && item.criticality !== 'CRITICAL',
    );
    const review = reviewRecord(caseValue, 'PLATFORM_OWNER', 'platform-owner-01');
    testCase.mutate(review);
    writeJson(input.submissionPath, submission(input.packet, 'platform-primary', [review]));
    assert.throws(() => run(input), testCase.expected, testCase.name);
  });
}

withFixture((input) => {
  const cases = input.packet.cases.filter(
    (item) => item.domain === 'PLATFORM' && item.criticality !== 'CRITICAL',
  );
  const first = reviewRecord(cases[0], 'PLATFORM_OWNER', 'platform-owner-01');
  const second = reviewRecord(cases[1], 'PLATFORM_OWNER', 'platform-owner-02');
  second.review_id = first.review_id;
  resign(second);
  writeJson(input.submissionPath, submission(input.packet, 'platform-primary', [first, second]));
  assert.throws(() => run(input), /duplicate review ID in submission/);
});

withFixture((input) => {
  const caseValue = input.packet.cases.find(
    (item) => item.domain === 'PLATFORM' && item.criticality !== 'CRITICAL',
  );
  const existingReview = reviewRecord(
    caseValue,
    'PLATFORM_OWNER',
    'platform-owner-existing',
    'existing',
  );
  const existing = json(input.existingReviewsPath);
  existing.reviews = [existingReview];
  validateReviews(existing, validateCorpus(buildCorpus()));
  writeJson(input.existingReviewsPath, existing);

  const assessment = computeAssessment(buildCorpus(), existing);
  const packet = json(input.packetPath);
  packet.baseline_assessment_sha256 = assessment.assessment_sha256;
  packet.counts.existing_reviews = 1;
  const packetPayload = { ...packet };
  delete packetPayload.packet_sha256;
  packet.packet_sha256 = sha256(packetPayload);
  writeJson(input.packetPath, packet);
  input.packet = packet;

  const replacement = reviewRecord(
    caseValue,
    'PLATFORM_OWNER',
    'platform-owner-existing',
    'replacement',
  );
  writeJson(input.submissionPath, submission(packet, 'platform-primary', [replacement]));
  assert.throws(() => run(input), /reviewer\/case pair already exists/);
});

withFixture((input) => {
  const caseValue = input.packet.cases.find(
    (item) => item.domain === 'PLATFORM' && item.criticality !== 'CRITICAL',
  );
  const review = reviewRecord(caseValue, 'PLATFORM_OWNER', 'platform-owner-01');
  const envelope = submission(input.packet, 'platform-primary', [review]);
  envelope.packet_sha256 = '0'.repeat(64);
  writeJson(input.submissionPath, envelope);
  assert.throws(() => run(input), /submission packet mismatch/);
});

process.stdout.write('expert review submission intake tests: PASS\n');
