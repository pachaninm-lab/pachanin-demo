#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  buildCorpus,
  computeAssessment,
  loadAuthority,
  sha256,
  validateAuthority,
  validateCorpus,
  validateReviews,
} from './gold-set-authority.mjs';

function approval(caseValue, reviewerId, reviewerRole, sequence) {
  const review = {
    review_id: `test.${caseValue.case_id}.${sequence}`,
    case_id: caseValue.case_id,
    case_sha256: caseValue.case_sha256,
    reviewer_id: reviewerId,
    reviewer_role: reviewerRole,
    decision: 'APPROVED',
    reviewed_at: '2026-07-19T20:00:00+00:00',
    evidence_sha256: sha256({
      fixture: true,
      case_id: caseValue.case_id,
      reviewer_role: reviewerRole,
    }),
    disagreement_with_review_id: null,
  };
  review.review_sha256 = sha256(review);
  return review;
}

const governed = validateAuthority();
assert.equal(governed.assessment.accepted, false);
assert.equal(governed.assessment.status, 'PENDING_REVIEW');
assert.equal(governed.assessment.counts.platform_roles, 12);
assert.equal(governed.assessment.counts.deal_states, 23);
assert.equal(governed.assessment.counts.agro_topics, 8);
assert.equal(governed.assessment.counts.locales, 3);
assert.equal(governed.assessment.counts.total_cases, 58);
assert.deepEqual(governed.assessment.blocking_reasons, ['EXPERT_REVIEWS_MISSING']);

const promptTamper = buildCorpus();
promptTamper.platform.cases[0].prompts.ru += ' Подмена.';
assert.throws(() => validateCorpus(promptTamper), /prompt digest/);

const missingRole = buildCorpus();
missingRole.platform.cases = missingRole.platform.cases.filter(
  (caseValue) => caseValue.case_id !== 'platform.role.bank',
);
assert.throws(() => validateCorpus(missingRole), /platform case count mismatch/);

const coverageTamper = buildCorpus();
coverageTamper.coverage.families[0].authority_refs = ['platform.ai-boundary.v1'];
assert.throws(() => validateCorpus(coverageTamper), /citations/);

const corpus = buildCorpus();
const caseMap = validateCorpus(corpus);
const { reviews: emptyReviews } = loadAuthority();

const staleReviews = structuredClone(emptyReviews);
const firstCase = corpus.platform.cases[0];
const stale = approval(firstCase, 'reviewer.platform.owner', 'PLATFORM_OWNER', 1);
stale.case_sha256 = '0'.repeat(64);
const stalePayload = { ...stale };
delete stalePayload.review_sha256;
stale.review_sha256 = sha256(stalePayload);
staleReviews.reviews = [stale];
assert.throws(() => validateReviews(staleReviews, caseMap), /stale case digest/);

const acceptedReviews = structuredClone(emptyReviews);
acceptedReviews.reviews = [];
for (const caseValue of [...corpus.platform.cases, ...corpus.agro.cases]) {
  const primaryRole = caseValue.domain === 'PLATFORM' ? 'PLATFORM_OWNER' : 'DOMAIN_EXPERT';
  const primaryId =
    caseValue.domain === 'PLATFORM'
      ? 'reviewer.platform.owner'
      : 'reviewer.agro.domain';
  acceptedReviews.reviews.push(approval(caseValue, primaryId, primaryRole, 1));
  if (caseValue.criticality === 'CRITICAL') {
    const secondaryRole =
      caseValue.domain === 'PLATFORM'
        ? 'SECURITY_REVIEWER'
        : 'LEGAL_OR_METHOD_REVIEWER';
    const secondaryId =
      caseValue.domain === 'PLATFORM'
        ? 'reviewer.security'
        : 'reviewer.legal';
    acceptedReviews.reviews.push(
      approval(caseValue, secondaryId, secondaryRole, 2),
    );
  }
}
validateReviews(acceptedReviews, caseMap);
const accepted = computeAssessment(corpus, acceptedReviews);
assert.equal(accepted.accepted, true);
assert.equal(accepted.status, 'ACCEPTED');
assert.equal(accepted.counts.reviewed_cases, 58);
assert.equal(accepted.counts.unreviewed_cases, 0);
assert.deepEqual(accepted.blocking_reasons, []);

process.stdout.write('PASS: AP-14C gold-set authority fail-closed tests\n');
