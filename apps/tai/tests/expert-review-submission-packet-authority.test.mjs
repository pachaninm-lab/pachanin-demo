#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import {
  buildExpertReviewPacket,
  materializeExpertReviewPacket,
} from '../model-artifacts/expert-review-packet.mjs';
import { ingestExpertReviewSubmission } from '../model-artifacts/expert-review-submission-intake.mjs';
import { sha256 } from '../../../docs/platform-v7/autopilot/tai-ap-14c/gold-set-authority.mjs';

const exactMain = 'b'.repeat(40);
const root = mkdtempSync(resolve(tmpdir(), 'tai-forged-review-packet-'));

try {
  const packetDirectory = resolve(root, 'packet');
  const packet = buildExpertReviewPacket({
    exactMainSha: exactMain,
    generatedAt: '2026-07-21T10:00:00Z',
  });
  materializeExpertReviewPacket(packet, packetDirectory);

  const packetPath = resolve(packetDirectory, 'expert-review-packet.v1.json');
  const forged = JSON.parse(readFileSync(packetPath, 'utf8'));
  const agroCase = forged.cases.find((item) => item.domain === 'AGRO');
  assert.ok(agroCase);
  const platformTrack = forged.reviewer_tracks.find(
    (item) => item.track_id === 'platform-primary',
  );
  assert.ok(platformTrack);
  platformTrack.case_ids.push(agroCase.case_id);
  platformTrack.case_count += 1;
  const forgedPayload = { ...forged };
  delete forgedPayload.packet_sha256;
  forged.packet_sha256 = sha256(forgedPayload);
  writeFileSync(packetPath, `${JSON.stringify(forged, null, 2)}\n`, 'utf8');

  const review = {
    review_id: 'forged-cross-domain-review-01',
    case_id: agroCase.case_id,
    case_sha256: agroCase.case_sha256,
    reviewer_id: 'platform-owner-01',
    reviewer_role: 'PLATFORM_OWNER',
    decision: 'APPROVED',
    reviewed_at: '2026-07-21T10:10:00Z',
    evidence_sha256: 'e'.repeat(64),
    disagreement_with_review_id: null,
    review_sha256: '',
  };
  const reviewPayload = { ...review };
  delete reviewPayload.review_sha256;
  review.review_sha256 = sha256(reviewPayload);

  const submissionPath = resolve(root, 'submission.json');
  writeFileSync(
    submissionPath,
    `${JSON.stringify({
      schema_version: 'tai.expert-review-submission.v1',
      exact_main_sha: exactMain,
      corpus_sha256: forged.corpus_sha256,
      packet_sha256: forged.packet_sha256,
      track_id: 'platform-primary',
      submitter_id: 'review-coordinator-01',
      submitted_at: '2026-07-21T10:20:00Z',
      reviews: [review],
    }, null, 2)}\n`,
    'utf8',
  );

  assert.throws(
    () => ingestExpertReviewSubmission({
      packetPath,
      submissionPath,
      existingReviewsPath: resolve(
        'docs/platform-v7/autopilot/tai-ap-14c/expert-reviews.v1.json',
      ),
      exactMainSha: exactMain,
      evaluatedAt: '2026-07-21T10:20:00Z',
      outputReviewsPath: resolve(root, 'candidate-reviews.json'),
      outputAssessmentPath: resolve(root, 'candidate-assessment.json'),
      outputReportPath: resolve(root, 'candidate-report.json'),
    }),
    /packet does not match current governed packet authority/,
  );

  process.stdout.write('expert review packet authority adversarial test: PASS\n');
} finally {
  rmSync(root, { recursive: true, force: true });
}
