#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildCorpus,
  computeAssessment,
  sha256,
  validateCorpus,
  validateReviews,
} from '../../../docs/platform-v7/autopilot/tai-ap-14c/gold-set-authority.mjs';
import { REVIEWER_TRACKS } from './expert-review-packet.mjs';

const SHA1 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ALLOWED_DECISIONS = new Set(['APPROVED', 'REJECTED', 'NEEDS_CHANGES']);
const ROOT_KEYS = new Set([
  'schema_version',
  'exact_main_sha',
  'corpus_sha256',
  'packet_sha256',
  'track_id',
  'submitter_id',
  'submitted_at',
  'reviews',
]);
const REVIEW_KEYS = new Set([
  'review_id',
  'case_id',
  'case_sha256',
  'reviewer_id',
  'reviewer_role',
  'decision',
  'reviewed_at',
  'evidence_sha256',
  'disagreement_with_review_id',
  'review_sha256',
]);
const PLACEHOLDERS = new Set([
  'example',
  'none',
  'null',
  'placeholder',
  'reviewer',
  'tbd',
  'todo',
  'unknown',
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function object(value, name) {
  invariant(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    `${name} must be an object`,
  );
  return value;
}

function exactKeys(value, expected, name) {
  const observed = new Set(Object.keys(value));
  const missing = [...expected].filter((key) => !observed.has(key)).sort();
  const unknown = [...observed].filter((key) => !expected.has(key)).sort();
  invariant(
    missing.length === 0 && unknown.length === 0,
    `${name} keys invalid; missing=${JSON.stringify(missing)}, unknown=${JSON.stringify(unknown)}`,
  );
}

function parseJson(path, name) {
  let value;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${name} is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  return object(value, name);
}

function fileSha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function timestamp(value, name) {
  invariant(
    typeof value === 'string'
      && Number.isFinite(Date.parse(value))
      && /(?:Z|[+-]\d{2}:\d{2})$/.test(value),
    `${name} must be a timezone-aware timestamp`,
  );
  return Date.parse(value);
}

function portableId(value, name) {
  invariant(typeof value === 'string' && ID.test(value), `${name} must be a portable ID`);
  return value;
}

function humanId(value, name) {
  const id = portableId(value, name);
  const normalized = id.toLowerCase();
  invariant(!PLACEHOLDERS.has(normalized), `${name} must not be a placeholder`);
  invariant(!normalized.startsWith('example-'), `${name} must not be an example identity`);
  return id;
}

function atomicJson(path, value) {
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  try {
    const stat = lstatSync(target);
    invariant(!stat.isSymbolicLink(), `${target} must not be a symbolic link`);
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
  }
  const temporary = `${target}.tmp-${process.pid}`;
  const content = `${JSON.stringify(value, null, 2)}\n`;
  try {
    writeFileSync(temporary, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    renameSync(temporary, target);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function caseContract(caseValue, policy) {
  const critical = caseValue.criticality === 'CRITICAL';
  return {
    case_id: caseValue.case_id,
    case_sha256: caseValue.case_sha256,
    prompt_sha256: caseValue.prompt_sha256,
    domain: caseValue.domain,
    criticality: caseValue.criticality,
    variant_kind: caseValue.variant_kind,
    prompts: caseValue.prompts,
    expected_statuses: caseValue.expected_statuses,
    required_concepts: caseValue.required_concepts,
    forbidden_claims: caseValue.forbidden_claims,
    expected_citations: caseValue.expected_citations,
    abstention_reason_codes: caseValue.abstention_reason_codes,
    required_review: {
      minimum_independent_approvals: critical
        ? policy.minimum_independent_approvals_for_critical
        : policy.minimum_approvals_per_case,
      primary_role: policy.required_primary_role_by_domain[caseValue.domain],
      secondary_roles: critical ? policy.critical_secondary_roles : [],
    },
  };
}

function expectedPacketPayload(packet, corpus, existingReviews, currentAssessment) {
  const cases = [...corpus.platform.cases, ...corpus.agro.cases];
  const tracks = REVIEWER_TRACKS.map((track) => {
    const selected = cases.filter(
      (caseValue) => track.domains.includes(caseValue.domain)
        && (!track.critical_only || caseValue.criticality === 'CRITICAL'),
    );
    return {
      ...track,
      case_count: selected.length,
      critical_case_count: selected.filter(
        (caseValue) => caseValue.criticality === 'CRITICAL',
      ).length,
      case_ids: selected.map((caseValue) => caseValue.case_id),
    };
  });
  return {
    schema_version: 'tai.expert-review-packet.v1',
    exact_main_sha: packet.exact_main_sha,
    generated_at: packet.generated_at,
    corpus_version: corpus.platform.version,
    corpus_sha256: currentAssessment.corpus_sha256,
    baseline_assessment_sha256: currentAssessment.assessment_sha256,
    required_locales: corpus.platform.required_locales,
    counts: {
      total_cases: cases.length,
      platform_cases: corpus.platform.cases.length,
      agro_cases: corpus.agro.cases.length,
      critical_cases: cases.filter(
        (caseValue) => caseValue.criticality === 'CRITICAL',
      ).length,
      existing_reviews: existingReviews.reviews.length,
    },
    review_policy: existingReviews.policy,
    reviewer_tracks: tracks,
    cases: cases.map((caseValue) => caseContract(caseValue, existingReviews.policy)),
    record_contract: {
      schema_version: 'tai.expert-reviews.v1',
      allowed_decisions: ['APPROVED', 'REJECTED', 'NEEDS_CHANGES'],
      human_identity_required: true,
      external_evidence_sha256_required: true,
      timezone_aware_reviewed_at_required: true,
      review_sha256_rule: 'SHA256_CANONICAL_JSON_EXCLUDING_REVIEW_SHA256',
      automation_may_create_decision: false,
    },
    automation_boundary: 'AUTOMATION_MUST_NOT_CREATE_REVIEW_DECISIONS',
    maturity_boundary: {
      expert_review_status: currentAssessment.status,
      benchmark_status: 'PENDING_BENCHMARK',
      model_admission_status: 'PENDING_ADMISSION',
      production_operational_status: 'NOT_ATTESTED',
    },
  };
}

function validatePacket(
  packet,
  corpus,
  existingReviews,
  currentAssessment,
  expectedExactMain,
) {
  invariant(packet.schema_version === 'tai.expert-review-packet.v1', 'packet schema mismatch');
  invariant(SHA1.test(packet.exact_main_sha), 'packet exact_main_sha is invalid');
  invariant(packet.exact_main_sha === expectedExactMain, 'packet exact-main mismatch');
  timestamp(packet.generated_at, 'packet.generated_at');
  invariant(SHA256.test(packet.packet_sha256), 'packet SHA-256 is invalid');
  const payload = { ...packet };
  delete payload.packet_sha256;
  const expected = expectedPacketPayload(
    packet,
    corpus,
    existingReviews,
    currentAssessment,
  );
  const expectedDigest = sha256(expected);
  invariant(packet.packet_sha256 === sha256(payload), 'packet digest mismatch');
  invariant(
    packet.packet_sha256 === expectedDigest && sha256(payload) === expectedDigest,
    'packet does not match current governed packet authority',
  );
  return timestamp(packet.generated_at, 'packet.generated_at');
}

function validateReviewRecord(review, index, context) {
  const name = `submission.reviews[${index}]`;
  object(review, name);
  exactKeys(review, REVIEW_KEYS, name);
  const reviewId = portableId(review.review_id, `${name}.review_id`);
  const caseId = portableId(review.case_id, `${name}.case_id`);
  const reviewerId = humanId(review.reviewer_id, `${name}.reviewer_id`);
  invariant(context.allowedCases.has(caseId), `${reviewId}: case is outside reviewer track`);
  const caseValue = context.caseMap.get(caseId);
  invariant(review.case_sha256 === caseValue.case_sha256, `${reviewId}: stale case digest`);
  invariant(review.reviewer_role === context.track.reviewer_role, `${reviewId}: reviewer role does not match track`);
  invariant(ALLOWED_DECISIONS.has(review.decision), `${reviewId}: unsupported decision`);
  invariant(SHA256.test(review.evidence_sha256), `${reviewId}: evidence SHA-256 is invalid`);
  const reviewedAt = timestamp(review.reviewed_at, `${reviewId}.reviewed_at`);
  invariant(reviewedAt >= context.packetGeneratedAt, `${reviewId}: review predates packet`);
  invariant(reviewedAt <= context.submittedAt, `${reviewId}: review is after submission`);
  invariant(reviewedAt <= context.latestAllowedTime, `${reviewId}: review is in the future`);
  invariant(
    review.disagreement_with_review_id === null
      || (typeof review.disagreement_with_review_id === 'string'
        && ID.test(review.disagreement_with_review_id)),
    `${reviewId}: disagreement target is invalid`,
  );
  const payload = { ...review };
  delete payload.review_sha256;
  invariant(
    SHA256.test(review.review_sha256) && review.review_sha256 === sha256(payload),
    `${reviewId}: review digest mismatch`,
  );
  return { reviewId, caseId, reviewerId };
}

export function ingestExpertReviewSubmission({
  packetPath,
  submissionPath,
  existingReviewsPath,
  exactMainSha,
  evaluatedAt,
  outputReviewsPath,
  outputAssessmentPath,
  outputReportPath,
}) {
  invariant(SHA1.test(exactMainSha), 'exact-main must be a full Git SHA');
  const evaluatedAtMs = timestamp(evaluatedAt, 'evaluated_at');
  const latestAllowedTime = evaluatedAtMs + 5 * 60 * 1000;
  const packet = parseJson(packetPath, 'packet');
  const submission = parseJson(submissionPath, 'submission');
  const existingReviews = parseJson(existingReviewsPath, 'existing reviews');

  const corpus = buildCorpus();
  const caseMap = validateCorpus(corpus);
  validateReviews(existingReviews, caseMap);
  const currentAssessment = computeAssessment(corpus, existingReviews);
  const packetGeneratedAt = validatePacket(
    packet,
    corpus,
    existingReviews,
    currentAssessment,
    exactMainSha,
  );

  exactKeys(submission, ROOT_KEYS, 'submission');
  invariant(
    submission.schema_version === 'tai.expert-review-submission.v1',
    'submission schema mismatch',
  );
  invariant(submission.exact_main_sha === packet.exact_main_sha, 'submission exact-main mismatch');
  invariant(submission.corpus_sha256 === packet.corpus_sha256, 'submission corpus mismatch');
  invariant(submission.packet_sha256 === packet.packet_sha256, 'submission packet mismatch');
  const submitterId = humanId(submission.submitter_id, 'submission.submitter_id');
  const submittedAt = timestamp(submission.submitted_at, 'submission.submitted_at');
  invariant(submittedAt >= packetGeneratedAt, 'submission predates packet');
  invariant(submittedAt <= latestAllowedTime, 'submission timestamp is in the future');
  invariant(Array.isArray(submission.reviews) && submission.reviews.length > 0, 'submission reviews must be non-empty');

  const trackId = portableId(submission.track_id, 'submission.track_id');
  const track = packet.reviewer_tracks.find((item) => item.track_id === trackId);
  invariant(track, `unknown reviewer track ${trackId}`);
  const allowedCases = new Set(track.case_ids);

  const existingIds = new Set();
  const existingPairs = new Set();
  const allById = new Map();
  for (const review of existingReviews.reviews) {
    existingIds.add(review.review_id);
    existingPairs.add(`${review.case_id}:${review.reviewer_id}`);
    allById.set(review.review_id, review);
  }
  const submissionIds = new Set();
  const submissionPairs = new Set();
  const parsed = [];
  const context = {
    allowedCases,
    caseMap,
    latestAllowedTime,
    packetGeneratedAt,
    submittedAt,
    track,
  };
  for (let index = 0; index < submission.reviews.length; index += 1) {
    const review = submission.reviews[index];
    const { reviewId, caseId, reviewerId } = validateReviewRecord(review, index, context);
    const pair = `${caseId}:${reviewerId}`;
    invariant(!existingIds.has(reviewId), `${reviewId}: review ID already exists`);
    invariant(!existingPairs.has(pair), `${reviewId}: reviewer/case pair already exists`);
    invariant(!submissionIds.has(reviewId), `${reviewId}: duplicate review ID in submission`);
    invariant(!submissionPairs.has(pair), `${reviewId}: duplicate reviewer/case pair in submission`);
    submissionIds.add(reviewId);
    submissionPairs.add(pair);
    allById.set(reviewId, review);
    parsed.push(review);
  }

  for (const review of parsed) {
    if (review.disagreement_with_review_id !== null) {
      const target = allById.get(review.disagreement_with_review_id);
      invariant(target, `${review.review_id}: disagreement target does not exist`);
      invariant(target.case_id === review.case_id, `${review.review_id}: disagreement target must concern the same case`);
      invariant(target.reviewer_id !== review.reviewer_id, `${review.review_id}: self-disagreement is forbidden`);
    }
  }

  const candidateReviews = {
    schema_version: existingReviews.schema_version,
    version: existingReviews.version,
    policy: existingReviews.policy,
    reviews: [...existingReviews.reviews, ...parsed].sort((left, right) => {
      const leftKey = `${left.case_id}\u0000${left.reviewer_role}\u0000${left.reviewer_id}\u0000${left.review_id}`;
      const rightKey = `${right.case_id}\u0000${right.reviewer_role}\u0000${right.reviewer_id}\u0000${right.review_id}`;
      return leftKey.localeCompare(rightKey);
    }),
  };
  validateReviews(candidateReviews, caseMap);
  const candidateAssessment = computeAssessment(corpus, candidateReviews);
  const report = {
    schema_version: 'tai.expert-review-intake-report.v1',
    status: 'CANDIDATE_WRITTEN_FOR_HUMAN_PR_REVIEW',
    exact_main_sha: exactMainSha,
    evaluated_at: evaluatedAt,
    packet_sha256: packet.packet_sha256,
    corpus_sha256: packet.corpus_sha256,
    track_id: trackId,
    reviewer_role: track.reviewer_role,
    submitter_id: submitterId,
    submission_sha256: fileSha256(submissionPath),
    existing_reviews_sha256: fileSha256(existingReviewsPath),
    reviews_added: parsed.length,
    candidate_review_count: candidateReviews.reviews.length,
    candidate_reviews_sha256: sha256(candidateReviews),
    candidate_assessment_sha256: candidateAssessment.assessment_sha256,
    candidate_assessment_status: candidateAssessment.status,
    candidate_accepted: candidateAssessment.accepted,
    candidate_blocking_reasons: candidateAssessment.blocking_reasons,
    candidate_unreviewed_cases: candidateAssessment.counts.unreviewed_cases,
    automation_created_decisions: false,
    requires_human_pull_request_review: true,
    benchmark_status: 'PENDING_BENCHMARK',
    model_admission_status: 'PENDING_ADMISSION',
    production_operational_status: 'NOT_ATTESTED',
  };
  report.report_sha256 = sha256(report);

  const outputs = [outputReviewsPath, outputAssessmentPath, outputReportPath].map((value) => resolve(value));
  invariant(new Set(outputs).size === outputs.length, 'output paths must be distinct');
  atomicJson(outputReviewsPath, candidateReviews);
  atomicJson(outputAssessmentPath, candidateAssessment);
  atomicJson(outputReportPath, report);
  return report;
}

function parseArgs(argv) {
  const result = {
    packetPath: '',
    submissionPath: '',
    existingReviewsPath: '',
    exactMainSha: '',
    evaluatedAt: '',
    outputReviewsPath: '',
    outputAssessmentPath: '',
    outputReportPath: '',
  };
  const mapping = {
    '--packet': 'packetPath',
    '--submission': 'submissionPath',
    '--existing-reviews': 'existingReviewsPath',
    '--exact-main': 'exactMainSha',
    '--evaluated-at': 'evaluatedAt',
    '--output-reviews': 'outputReviewsPath',
    '--output-assessment': 'outputAssessmentPath',
    '--output-report': 'outputReportPath',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = mapping[argv[index]];
    invariant(key, `unknown argument: ${argv[index]}`);
    const value = argv[++index] ?? '';
    invariant(value, `${argv[index - 1]} requires a value`);
    result[key] = key.endsWith('Path') ? resolve(value) : value;
  }
  for (const [key, value] of Object.entries(result)) invariant(value, `${key} is required`);
  return result;
}

function main() {
  const report = ingestExpertReviewSubmission(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
