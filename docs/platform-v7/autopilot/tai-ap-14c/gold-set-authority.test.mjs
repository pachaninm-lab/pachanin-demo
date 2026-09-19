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


// --- INFORMATIONAL_ONLY boundary, owner decision of 26.07.2026 -------------------------
//
// These pin the global concepts to the corpus rather than to a sample. Applying them in
// `finalizeCase` is what makes them global; asserting them over every case is what keeps
// them that way when a case is added later.

const GLOBAL_REQUIRED = [
  'INFORMATIONAL_ONLY',
  'MANUAL_USER_EXECUTION',
  'SERVER_AUTHORIZED_READ_SCOPE',
  'RECOMMENDATION_NOT_COMMAND',
];
const GLOBAL_FORBIDDEN = [
  'AI_INITIATED_WRITE',
  'AI_CONFIRMED_WRITE',
  'AI_PERSISTED_DRAFT',
  'AI_STATE_CHANGE',
  'AI_ACTION_EXECUTION',
];

const everyCase = [...corpus.platform.cases, ...corpus.agro.cases];
assert.equal(everyCase.length, 58);

for (const caseValue of everyCase) {
  for (const concept of GLOBAL_REQUIRED) {
    assert.ok(
      caseValue.required_concepts.includes(concept),
      `${caseValue.case_id} is missing required concept ${concept}`,
    );
  }
  for (const claim of GLOBAL_FORBIDDEN) {
    assert.ok(
      caseValue.forbidden_claims.includes(claim),
      `${caseValue.case_id} is missing forbidden claim ${claim}`,
    );
  }
  // A duplicate would be a validation failure downstream, and would also mean a case
  // declared a global by hand instead of inheriting it.
  assert.equal(
    new Set(caseValue.required_concepts).size,
    caseValue.required_concepts.length,
    `${caseValue.case_id} has duplicate required concepts`,
  );
  assert.equal(
    new Set(caseValue.forbidden_claims).size,
    caseValue.forbidden_claims.length,
    `${caseValue.case_id} has duplicate forbidden claims`,
  );
}

// Role and state cases must ask for an informational next action, never an executable one.
for (const caseValue of corpus.platform.cases) {
  if (!/^platform\.(role|state)\./.test(caseValue.case_id)) continue;
  assert.ok(
    caseValue.required_concepts.includes('INFORMATIONAL_NEXT_ACTIONS_ONLY'),
    `${caseValue.case_id} must require INFORMATIONAL_NEXT_ACTIONS_ONLY`,
  );
  assert.ok(
    caseValue.required_concepts.includes('SERVER_DERIVED_CONTEXT_SCOPE'),
    `${caseValue.case_id} must limit concrete data to server-derived scope`,
  );
  assert.ok(
    caseValue.forbidden_claims.includes('ACTION_PREPARED_FOR_EXECUTION'),
    `${caseValue.case_id} must forbid preparing an action for execution`,
  );
  assert.ok(
    !caseValue.required_concepts.includes('NEXT_ACTIONS'),
    `${caseValue.case_id} still carries the pre-decision NEXT_ACTIONS concept`,
  );
  assert.ok(
    !caseValue.required_concepts.includes('SERVER_AUTHORIZED_NEXT_ACTION'),
    `${caseValue.case_id} still carries the pre-decision SERVER_AUTHORIZED_NEXT_ACTION`,
  );
}

const byId = new Map(everyCase.map((caseValue) => [caseValue.case_id, caseValue]));

// Wheat quality: a moisture limit is meaningless without a class or use and the scope of
// the standard, and no single figure is universal.
const wheat = byId.get('agro.variant.typo-wheat-quality');
assert.ok(wheat, 'agro.variant.typo-wheat-quality is missing');
for (const concept of ['GRAIN_CLASS_OR_USE', 'STANDARD_SCOPE']) {
  assert.ok(wheat.required_concepts.includes(concept), `wheat case missing ${concept}`);
}
assert.ok(wheat.forbidden_claims.includes('UNIVERSAL_MOISTURE_LIMIT'));
assert.ok(wheat.abstention_reason_codes.includes('QUERY_SCOPE_MISSING'));

// Pesticide dose: abstention is the only allowed answer, the authority is the product
// label or a state registry, and a Rosselkhozcenter forecast is not a dose authority — so
// the case cites nothing rather than citing a source that cannot carry the answer.
const dose = byId.get('agro.variant.pesticide-dose');
assert.ok(dose, 'agro.variant.pesticide-dose is missing');
assert.deepEqual(dose.expected_statuses, ['ABSTAINED']);
for (const concept of [
  'PRODUCT_IDENTITY',
  'CROP',
  'CROP_STAGE',
  'REGION',
  'PEST',
  'OFFICIAL_LABEL_OR_STATE_REGISTRY_AUTHORITY',
]) {
  assert.ok(dose.required_concepts.includes(concept), `dose case missing ${concept}`);
}
assert.ok(dose.forbidden_claims.includes('FORECAST_AS_DOSE_AUTHORITY'));
assert.deepEqual(dose.expected_citations, []);
assert.ok(!dose.expected_citations.includes('official.rosselhoscenter.agronomy'));

process.stdout.write('PASS: AP-14C gold-set authority fail-closed tests\n');
