#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildCorpus,
  canonicalJson,
  computeAssessment,
  sha256,
  validateCorpus,
  validateReviews,
} from '../../../docs/platform-v7/autopilot/tai-ap-14c/gold-set-authority.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLD_ROOT = resolve(
  HERE,
  '../../../docs/platform-v7/autopilot/tai-ap-14c',
);
const REVIEWS_PATH = resolve(GOLD_ROOT, 'expert-reviews.v1.json');
const SHA1 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const REVIEWER_TRACKS = [
  {
    track_id: 'platform-primary',
    reviewer_role: 'PLATFORM_OWNER',
    domains: ['PLATFORM'],
    critical_only: false,
  },
  {
    track_id: 'agro-primary',
    reviewer_role: 'DOMAIN_EXPERT',
    domains: ['AGRO'],
    critical_only: false,
  },
  {
    track_id: 'critical-security',
    reviewer_role: 'SECURITY_REVIEWER',
    domains: ['PLATFORM', 'AGRO'],
    critical_only: true,
  },
  {
    track_id: 'critical-legal-method',
    reviewer_role: 'LEGAL_OR_METHOD_REVIEWER',
    domains: ['PLATFORM', 'AGRO'],
    critical_only: true,
  },
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parseJson(path) {
  const value = JSON.parse(readFileSync(path, 'utf8'));
  invariant(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    `${path} must contain an object`,
  );
  return value;
}

function timestamp(value) {
  invariant(
    typeof value === 'string' && Number.isFinite(Date.parse(value)),
    'generated_at must be a valid timestamp',
  );
  invariant(
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value),
    'generated_at must include a timezone',
  );
  return value;
}

function actualFileDigest(content) {
  return createHash('sha256').update(content).digest('hex');
}

function writeJson(path, value) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(path, content, 'utf8');
  return {
    path,
    sha256: actualFileDigest(content),
    size_bytes: Buffer.byteLength(content),
  };
}

function reviewTemplate(caseValue, reviewerRole) {
  return {
    review_id: null,
    case_id: caseValue.case_id,
    case_sha256: caseValue.case_sha256,
    reviewer_id: null,
    reviewer_role: reviewerRole,
    decision: null,
    reviewed_at: null,
    evidence_sha256: null,
    disagreement_with_review_id: null,
    review_sha256: null,
  };
}

function caseContract(caseValue, policy) {
  const primaryRole = policy.required_primary_role_by_domain[caseValue.domain];
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
      primary_role: primaryRole,
      secondary_roles: critical ? policy.critical_secondary_roles : [],
    },
  };
}

function trackCases(cases, track) {
  return cases.filter(
    (caseValue) =>
      track.domains.includes(caseValue.domain)
      && (!track.critical_only || caseValue.criticality === 'CRITICAL'),
  );
}

export function buildExpertReviewPacket({
  exactMainSha,
  generatedAt,
  reviewsPath = REVIEWS_PATH,
}) {
  invariant(
    typeof exactMainSha === 'string' && SHA1.test(exactMainSha),
    'exact_main_sha must be a full Git SHA',
  );
  timestamp(generatedAt);

  const corpus = buildCorpus();
  const caseMap = validateCorpus(corpus);
  const reviews = parseJson(reviewsPath);
  validateReviews(reviews, caseMap);
  const assessment = computeAssessment(corpus, reviews);
  const cases = [...corpus.platform.cases, ...corpus.agro.cases];
  const contracts = cases.map((caseValue) => caseContract(caseValue, reviews.policy));
  const tracks = REVIEWER_TRACKS.map((track) => {
    const selected = trackCases(cases, track);
    return {
      ...track,
      case_count: selected.length,
      critical_case_count: selected.filter(
        (caseValue) => caseValue.criticality === 'CRITICAL',
      ).length,
      case_ids: selected.map((caseValue) => caseValue.case_id),
    };
  });

  const packet = {
    schema_version: 'tai.expert-review-packet.v1',
    exact_main_sha: exactMainSha,
    generated_at: generatedAt,
    corpus_version: corpus.platform.version,
    corpus_sha256: assessment.corpus_sha256,
    baseline_assessment_sha256: assessment.assessment_sha256,
    required_locales: corpus.platform.required_locales,
    counts: {
      total_cases: cases.length,
      platform_cases: corpus.platform.cases.length,
      agro_cases: corpus.agro.cases.length,
      critical_cases: cases.filter(
        (caseValue) => caseValue.criticality === 'CRITICAL',
      ).length,
      existing_reviews: reviews.reviews.length,
    },
    review_policy: reviews.policy,
    reviewer_tracks: tracks,
    cases: contracts,
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
      expert_review_status: assessment.status,
      benchmark_status: 'PENDING_BENCHMARK',
      model_admission_status: 'PENDING_ADMISSION',
      production_operational_status: 'NOT_ATTESTED',
    },
  };
  packet.packet_sha256 = sha256(packet);
  invariant(SHA256.test(packet.packet_sha256), 'packet digest was not produced');
  return packet;
}

function trackPacket(packet, track) {
  const allowed = new Set(track.case_ids);
  const cases = packet.cases.filter((caseValue) => allowed.has(caseValue.case_id));
  return {
    schema_version: 'tai.expert-review-track.v1',
    exact_main_sha: packet.exact_main_sha,
    generated_at: packet.generated_at,
    corpus_version: packet.corpus_version,
    corpus_sha256: packet.corpus_sha256,
    packet_sha256: packet.packet_sha256,
    track,
    cases,
    review_templates: cases.map((caseValue) =>
      reviewTemplate(caseValue, track.reviewer_role),
    ),
    automation_boundary: packet.automation_boundary,
    maturity_boundary: packet.maturity_boundary,
  };
}

export function materializeExpertReviewPacket(packet, outputDirectory) {
  invariant(
    packet?.schema_version === 'tai.expert-review-packet.v1',
    'unsupported packet schema',
  );
  const packetPayload = { ...packet };
  delete packetPayload.packet_sha256;
  invariant(
    SHA256.test(packet.packet_sha256)
      && packet.packet_sha256 === sha256(packetPayload),
    'packet digest mismatch',
  );
  mkdirSync(outputDirectory, { recursive: true });

  const files = [];
  const master = writeJson(
    resolve(outputDirectory, 'expert-review-packet.v1.json'),
    packet,
  );
  files.push({
    name: 'expert-review-packet.v1.json',
    sha256: master.sha256,
    size_bytes: master.size_bytes,
  });
  for (const track of packet.reviewer_tracks) {
    const fileName = `track-${track.track_id}.v1.json`;
    const written = writeJson(
      resolve(outputDirectory, fileName),
      trackPacket(packet, track),
    );
    files.push({
      name: fileName,
      sha256: written.sha256,
      size_bytes: written.size_bytes,
    });
  }
  const submissionTemplate = {
    schema_version: 'tai.expert-reviews.v1',
    version: packet.corpus_version,
    policy: packet.review_policy,
    reviews: [],
  };
  const submission = writeJson(
    resolve(outputDirectory, 'review-submission-template.v1.json'),
    submissionTemplate,
  );
  files.push({
    name: 'review-submission-template.v1.json',
    sha256: submission.sha256,
    size_bytes: submission.size_bytes,
  });

  const manifest = {
    schema_version: 'tai.expert-review-packet-manifest.v1',
    exact_main_sha: packet.exact_main_sha,
    generated_at: packet.generated_at,
    packet_sha256: packet.packet_sha256,
    files,
    automation_boundary: packet.automation_boundary,
    production_operational_status: 'NOT_ATTESTED',
  };
  manifest.manifest_sha256 = sha256(manifest);
  writeJson(resolve(outputDirectory, 'packet-manifest.v1.json'), manifest);
  return manifest;
}

function parseArgs(argv) {
  const result = { exactMainSha: '', generatedAt: '', outputDirectory: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--exact-main') result.exactMainSha = argv[++index] ?? '';
    else if (arg === '--generated-at') result.generatedAt = argv[++index] ?? '';
    else if (arg === '--output-dir') {
      result.outputDirectory = resolve(argv[++index] ?? '');
    } else throw new Error(`unknown argument: ${arg}`);
  }
  invariant(result.outputDirectory, '--output-dir is required');
  return result;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const packet = buildExpertReviewPacket(options);
  const manifest = materializeExpertReviewPacket(
    packet,
    options.outputDirectory,
  );
  process.stdout.write(`${JSON.stringify({
    schema_version: manifest.schema_version,
    exact_main_sha: manifest.exact_main_sha,
    packet_sha256: manifest.packet_sha256,
    manifest_sha256: manifest.manifest_sha256,
    files: manifest.files.length,
    total_cases: packet.counts.total_cases,
    critical_cases: packet.counts.critical_cases,
    expert_review_status: packet.maturity_boundary.expert_review_status,
    production_operational_status:
      packet.maturity_boundary.production_operational_status,
  }, null, 2)}\n`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export { REVIEWER_TRACKS, canonicalJson };
