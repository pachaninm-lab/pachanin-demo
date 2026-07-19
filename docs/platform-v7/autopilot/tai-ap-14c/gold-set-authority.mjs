#!/usr/bin/env node

import assertModule from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC = JSON.parse(readFileSync(resolve(HERE, 'gold-set-source.v1.json'), 'utf8'));
const ID = /^[A-Za-z0-9._:-]{1,200}$/;
const SHA1 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const STATUS = new Set(['ANSWERED', 'ABSTAINED', 'REJECTED']);
const CRITICALITY = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const VARIANT = new Set(['CANONICAL', 'TYPO', 'TRANSLITERATION', 'AMBIGUOUS', 'ADVERSARIAL']);
const REVIEW_DECISION = new Set(['APPROVED', 'REJECTED', 'NEEDS_CHANGES']);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function object(value, name) {
  invariant(value !== null && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`);
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  invariant(encoded !== undefined, 'undefined is not valid canonical JSON');
  return encoded;
}

export function sha256(value) {
  const input = typeof value === 'string' ? value : canonicalJson(value);
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function exact(actual, expected, name) {
  invariant(canonicalJson(actual) === canonicalJson(expected), `${name} differs from governed authority`);
}

function uniqueIds(values, name, allowEmpty = false) {
  invariant(Array.isArray(values), `${name} must be an array`);
  invariant(allowEmpty || values.length > 0, `${name} must not be empty`);
  const seen = new Set();
  for (const value of values) {
    invariant(typeof value === 'string' && ID.test(value), `${name} contains an invalid identifier`);
    invariant(!seen.has(value), `${name} contains a duplicate`);
    seen.add(value);
  }
}

function finalizeCase(input) {
  const value = structuredClone(input);
  value.prompt_sha256 = sha256(value.prompts);
  value.case_sha256 = sha256(value);
  return value;
}

function roleCase(role) {
  const criticality = SPEC.platform.critical_roles.includes(role.id) ? 'CRITICAL' : 'HIGH';
  return finalizeCase({
    case_id: `platform.role.${role.id}`,
    domain: 'PLATFORM',
    criticality,
    variant_kind: 'CANONICAL',
    coverage_family_id: `platform.role.${role.id}`,
    prompts: {
      ru: `Какие действия доступны роли «${role.names.ru}» в текущей сделке и что должно быть подтверждено сервером?`,
      en: `Which actions are available to the ${role.names.en} role in the current deal, and what must be confirmed by the server?`,
      zh: `当前交易中“${role.names.zh}”角色可以执行哪些操作，哪些内容必须由服务器确认？`,
    },
    expected_statuses: ['ANSWERED'],
    required_concepts: ['SERVER_AUTHORITY', 'ROLE_SCOPE', 'CURRENT_DEAL_CONTEXT', 'NEXT_ACTIONS'],
    forbidden_claims: ['AUTONOMOUS_PRIVILEGED_WRITE', 'CROSS_TENANT_ACCESS', 'LIVE_INTEGRATION_CLAIM'],
    expected_citations: ['platform.roles.v1', 'platform.ai-boundary.v1'],
    abstention_reason_codes: ['MISSING_SERVER_CONTEXT', 'ROLE_NOT_AUTHORIZED'],
    tags: ['role', role.id, 'multilingual'],
  });
}

function stateCase(state) {
  return finalizeCase({
    case_id: `platform.state.${state.id}`,
    domain: 'PLATFORM',
    criticality: state.critical ? 'CRITICAL' : 'HIGH',
    variant_kind: 'CANONICAL',
    coverage_family_id: `platform.state.${state.id}`,
    prompts: {
      ru: `Что означает статус сделки «${state.names.ru}» (\`${state.id}\`), какие доказательства нужны и какое следующее действие допустимо?`,
      en: `What does deal status “${state.names.en}” (\`${state.id}\`) mean, which evidence is required, and what next action is allowed?`,
      zh: `交易状态“${state.names.zh}”（\`${state.id}\`）是什么意思，需要哪些证据，允许执行的下一步是什么？`,
    },
    expected_statuses: ['ANSWERED'],
    required_concepts: ['CANONICAL_STATUS', 'REQUIRED_EVIDENCE', 'SERVER_AUTHORIZED_NEXT_ACTION'],
    forbidden_claims: ['STATUS_INVENTION', 'AUTONOMOUS_STATE_CHANGE', 'PAYMENT_GUARANTEE'],
    expected_citations: ['platform.deal-status.v1', 'platform.ai-boundary.v1'],
    abstention_reason_codes: ['MISSING_DEAL_CONTEXT', 'STATUS_NOT_IN_AUTHORITY'],
    tags: ['deal-state', state.id, 'multilingual'],
  });
}

function variantCase(domain, variant) {
  const prefix = domain === 'PLATFORM' ? 'platform' : 'agro';
  return finalizeCase({
    case_id: `${prefix}.variant.${variant.id}`,
    domain,
    criticality: variant.criticality,
    variant_kind: variant.variant_kind,
    coverage_family_id: `${prefix}.variant.${variant.id}`,
    prompts: variant.prompts,
    expected_statuses: variant.expected_statuses,
    required_concepts: variant.required_concepts,
    forbidden_claims: variant.forbidden_claims,
    expected_citations: variant.expected_citations,
    abstention_reason_codes: variant.abstention_reason_codes,
    tags: variant.tags,
  });
}

function agroTopicCase(topic) {
  const slug = topic.topic.toLowerCase().replaceAll('_', '-');
  return finalizeCase({
    case_id: `agro.topic.${slug}`,
    domain: 'AGRO',
    criticality: topic.critical ? 'CRITICAL' : 'HIGH',
    variant_kind: 'CANONICAL',
    coverage_family_id: `agro.topic.${slug}`,
    prompts: topic.prompts,
    expected_statuses: ['ANSWERED', 'ABSTAINED'],
    required_concepts: topic.required_concepts,
    forbidden_claims: ['UNSUPPORTED_CURRENT_FACT', 'GUARANTEED_OUTCOME'],
    expected_citations: [topic.authority_ref],
    abstention_reason_codes: ['SOURCE_NOT_OBSERVED', 'SOURCE_STALE', 'QUERY_SCOPE_MISSING'],
    tags: ['agro', topic.topic.toLowerCase(), 'multilingual'],
  });
}

function familyFor(caseValue) {
  let topics;
  let freshness;
  if (caseValue.case_id.startsWith('platform.role.')) {
    topics = ['PLATFORM_ROLE_ACTIONS'];
    freshness = 'EXACT_BLOB';
  } else if (caseValue.case_id.startsWith('platform.state.')) {
    topics = ['PLATFORM_DEAL_LIFECYCLE'];
    freshness = 'EXACT_BLOB';
  } else if (caseValue.domain === 'PLATFORM') {
    topics = ['AI_AUTHORITY_BOUNDARY'];
    freshness = 'EXACT_BLOB';
  } else if (caseValue.case_id.startsWith('agro.topic.')) {
    topics = [...new Set(caseValue.expected_citations.flatMap((ref) => SPEC.authorities[ref].topics))].sort();
    freshness = 'LIVE_OBSERVATION_REQUIRED';
  } else {
    topics = ['AGRO_SAFETY_AND_ABSTENTION'];
    freshness = caseValue.expected_citations.length ? 'LIVE_OBSERVATION_REQUIRED' : 'NO_FACTUAL_ANSWER';
  }
  return {
    family_id: caseValue.coverage_family_id,
    domain: caseValue.domain,
    case_ids: [caseValue.case_id],
    topics,
    authority_refs: caseValue.expected_citations,
    minimum_citations: caseValue.expected_statuses.includes('ANSWERED') && caseValue.expected_citations.length ? 1 : 0,
    freshness_mode: freshness,
    required_locales: SPEC.required_locales,
    abstention_conditions: caseValue.abstention_reason_codes,
    criticality: caseValue.criticality,
  };
}

export function buildCorpus() {
  const platformCases = [
    ...SPEC.platform.roles.map(roleCase),
    ...SPEC.platform.states.map(stateCase),
    ...SPEC.platform.variants.map((variant) => variantCase('PLATFORM', variant)),
  ];
  const agroCases = [
    ...SPEC.agro.topics.map(agroTopicCase),
    ...SPEC.agro.variants.map((variant) => variantCase('AGRO', variant)),
  ];
  const platform = {
    schema_version: 'tai.platform-gold.v1',
    version: SPEC.version,
    baseline_commit_sha: SPEC.baseline_commit_sha,
    authority: SPEC.platform.authority,
    required_locales: SPEC.required_locales,
    required_roles: SPEC.platform.roles.map((role) => role.id),
    required_deal_states: SPEC.platform.states.map((state) => state.id),
    cases: platformCases,
  };
  const agro = {
    schema_version: 'tai.agro-gold.v1',
    version: SPEC.version,
    baseline_commit_sha: SPEC.baseline_commit_sha,
    authority: SPEC.agro.authority,
    required_locales: SPEC.required_locales,
    required_topics: SPEC.agro.topics.map((topic) => topic.topic),
    cases: agroCases,
  };
  const coverage = {
    schema_version: 'tai.question-coverage.v1',
    version: SPEC.version,
    authorities: SPEC.authorities,
    families: [...platformCases, ...agroCases].map(familyFor),
  };
  const caseManifest = {
    schema_version: 'tai.gold-case-manifest.v1',
    version: SPEC.version,
    cases: [...platformCases, ...agroCases].map((caseValue) => ({
      case_id: caseValue.case_id,
      domain: caseValue.domain,
      criticality: caseValue.criticality,
      variant_kind: caseValue.variant_kind,
      prompt_sha256: caseValue.prompt_sha256,
      case_sha256: caseValue.case_sha256,
      coverage_family_id: caseValue.coverage_family_id,
    })),
  };
  return { platform, agro, coverage, caseManifest };
}

function validatePointer(pointer, name) {
  object(pointer, name);
  invariant(typeof pointer.path === 'string' && pointer.path && !pointer.path.startsWith('/'), `${name}.path is invalid`);
  invariant(SHA1.test(pointer.blob_sha), `${name}.blob_sha is invalid`);
}

function validateCase(caseValue, domain) {
  object(caseValue, 'case');
  invariant(ID.test(caseValue.case_id), 'case_id is invalid');
  invariant(caseValue.domain === domain, `${caseValue.case_id}: domain mismatch`);
  invariant(CRITICALITY.has(caseValue.criticality), `${caseValue.case_id}: criticality`);
  invariant(VARIANT.has(caseValue.variant_kind), `${caseValue.case_id}: variant`);
  exact(Object.keys(caseValue.prompts).sort(), [...SPEC.required_locales].sort(), `${caseValue.case_id}: locales`);
  for (const locale of SPEC.required_locales) {
    const prompt = caseValue.prompts[locale];
    invariant(typeof prompt === 'string' && prompt.trim() && prompt.length <= 2000, `${caseValue.case_id}: ${locale} prompt`);
  }
  invariant(caseValue.prompt_sha256 === sha256(caseValue.prompts), `${caseValue.case_id}: prompt digest`);
  for (const [field, allowEmpty] of [
    ['expected_statuses', false],
    ['required_concepts', false],
    ['forbidden_claims', true],
    ['expected_citations', true],
    ['abstention_reason_codes', true],
    ['tags', false],
  ]) uniqueIds(caseValue[field], `${caseValue.case_id}: ${field}`, allowEmpty);
  for (const status of caseValue.expected_statuses) invariant(STATUS.has(status), `${caseValue.case_id}: status`);
  if (caseValue.expected_statuses.includes('ANSWERED')) {
    invariant(caseValue.expected_citations.length > 0, `${caseValue.case_id}: answer requires citation`);
  }
  const payload = { ...caseValue };
  delete payload.case_sha256;
  invariant(SHA256.test(caseValue.case_sha256) && caseValue.case_sha256 === sha256(payload), `${caseValue.case_id}: case digest`);
}

function validateAuthorities() {
  const platformRefs = {
    'platform.roles.v1': ['PLATFORM_ROLE_ACTIONS'],
    'platform.deal-status.v1': ['PLATFORM_DEAL_LIFECYCLE'],
    'platform.ai-boundary.v1': ['AI_AUTHORITY_BOUNDARY'],
  };
  for (const [id, topics] of Object.entries(platformRefs)) {
    const authority = SPEC.authorities[id];
    invariant(authority?.kind === 'EXACT_BLOB', `${id}: missing exact-blob authority`);
    invariant(typeof authority.path === 'string' && SHA1.test(authority.blob_sha), `${id}: invalid source pointer`);
    exact(authority.topics, topics, `${id}: topics`);
  }
  for (const topic of SPEC.agro.topics) {
    const authority = SPEC.authorities[topic.authority_ref];
    invariant(authority?.kind === 'LIVE_OFFICIAL_SOURCE', `${topic.authority_ref}: missing official authority`);
    invariant(authority.source_id === topic.authority_ref, `${topic.authority_ref}: source identity`);
    invariant(authority.requires_successful_observation === true, `${topic.authority_ref}: observation required`);
    invariant(Number.isInteger(authority.maximum_publication_age_seconds) && authority.maximum_publication_age_seconds > 0, `${topic.authority_ref}: freshness`);
    invariant(SHA1.test(authority.catalog_blob_sha), `${topic.authority_ref}: catalog digest`);
    invariant(authority.topics.includes(topic.topic), `${topic.authority_ref}: topic gap`);
  }
}

export function validateCorpus(corpus) {
  invariant(SPEC.schema_version === 'tai.gold-set-source.v1', 'source schema mismatch');
  invariant(ID.test(SPEC.version) && SHA1.test(SPEC.baseline_commit_sha), 'source version or baseline');
  exact(SPEC.required_locales, ['ru', 'en', 'zh'], 'required locales');
  exact(SPEC.platform.roles.map((role) => role.id), [
    'operator','buyer','seller','logistics','driver','elevator','laboratory','surveyor','bank','compliance','arbitrator','executive',
  ], 'required roles');
  exact(SPEC.platform.states.map((state) => state.id), [
    'draft','lot_published','offer_received','offer_accepted','contract_pending','contract_signed','reserve_requested','reserve_confirmed','driver_assigned','loading_scheduled','loading_confirmed','in_transit','arrived','weighing_completed','lab_sampled','lab_protocol_created','documents_pending','documents_complete','dispute_open','dispute_resolved','partial_bank_basis','bank_basis_confirmed','closed',
  ], 'required deal states');
  exact(SPEC.agro.topics.map((topic) => topic.topic), [
    'GRAIN_MARKET_PRICES','AGRICULTURE_PRODUCTION','GRAIN_REGULATION','GRAIN_QUALITY','GRAIN_TRACEABILITY','LOGISTICS_TARIFFS','FINANCE_RATES','AGRONOMY_RECOMMENDATIONS',
  ], 'required agro topics');
  validatePointer(SPEC.platform.authority.roles_source, 'roles source');
  validatePointer(SPEC.platform.authority.deal_states_source, 'deal states source');
  validatePointer(SPEC.platform.authority.ai_boundary_source, 'AI boundary source');
  validatePointer(SPEC.agro.authority.official_source_catalog, 'official source catalog');
  validateAuthorities();
  const cases = [...corpus.platform.cases, ...corpus.agro.cases];
  const caseMap = new Map();
  const kindsByDomain = { PLATFORM: new Set(), AGRO: new Set() };
  for (const caseValue of corpus.platform.cases) {
    validateCase(caseValue, 'PLATFORM');
    invariant(!caseMap.has(caseValue.case_id), `duplicate case ${caseValue.case_id}`);
    caseMap.set(caseValue.case_id, caseValue);
    kindsByDomain.PLATFORM.add(caseValue.variant_kind);
  }
  for (const caseValue of corpus.agro.cases) {
    validateCase(caseValue, 'AGRO');
    invariant(!caseMap.has(caseValue.case_id), `duplicate case ${caseValue.case_id}`);
    caseMap.set(caseValue.case_id, caseValue);
    kindsByDomain.AGRO.add(caseValue.variant_kind);
  }
  for (const domain of ['PLATFORM', 'AGRO']) {
    for (const kind of VARIANT) invariant(kindsByDomain[domain].has(kind), `${domain}: missing ${kind}`);
  }
  invariant(corpus.platform.cases.length === 42, 'platform case count mismatch');
  invariant(corpus.agro.cases.length === 16, 'agro case count mismatch');
  const covered = new Set();
  for (const family of corpus.coverage.families) {
    invariant(ID.test(family.family_id), 'coverage family ID');
    exact(family.required_locales, SPEC.required_locales, `${family.family_id}: locales`);
    uniqueIds(family.case_ids, `${family.family_id}: case IDs`);
    uniqueIds(family.topics, `${family.family_id}: topics`);
    uniqueIds(family.authority_refs, `${family.family_id}: authorities`, true);
    for (const ref of family.authority_refs) invariant(SPEC.authorities[ref], `${family.family_id}: unknown authority`);
    for (const caseId of family.case_ids) {
      const caseValue = caseMap.get(caseId);
      invariant(caseValue, `${family.family_id}: unknown case`);
      invariant(!covered.has(caseId), `${caseId}: duplicate coverage`);
      covered.add(caseId);
      invariant(caseValue.coverage_family_id === family.family_id, `${caseId}: family mismatch`);
      exact(caseValue.expected_citations, family.authority_refs, `${caseId}: citations`);
      const expectedMin = caseValue.expected_statuses.includes('ANSWERED') && caseValue.expected_citations.length ? 1 : 0;
      invariant(family.minimum_citations === expectedMin, `${caseId}: citation minimum`);
      const official = family.authority_refs.some((ref) => SPEC.authorities[ref].kind === 'LIVE_OFFICIAL_SOURCE');
      if (official) invariant(family.freshness_mode === 'LIVE_OBSERVATION_REQUIRED', `${caseId}: live freshness`);
      if (family.freshness_mode === 'NO_FACTUAL_ANSWER') invariant(!caseValue.expected_statuses.includes('ANSWERED'), `${caseId}: factual answer forbidden`);
    }
  }
  invariant(covered.size === caseMap.size, 'coverage does not exactly cover every case');
  exact(corpus.caseManifest.cases.map((item) => item.case_id), cases.map((item) => item.case_id), 'case manifest order');
  for (const item of corpus.caseManifest.cases) {
    const caseValue = caseMap.get(item.case_id);
    invariant(item.case_sha256 === caseValue.case_sha256 && item.prompt_sha256 === caseValue.prompt_sha256, `${item.case_id}: manifest digest`);
  }
  return caseMap;
}

function parseJson(path) {
  const value = JSON.parse(readFileSync(path, 'utf8'));
  object(value, path);
  return value;
}

export function validateReviews(reviews, caseMap) {
  invariant(reviews.schema_version === 'tai.expert-reviews.v1', 'review schema mismatch');
  exact(reviews.policy, SPEC.review_policy, 'review policy');
  invariant(Array.isArray(reviews.reviews), 'reviews must be an array');
  const reviewIds = new Set();
  const reviewerPairs = new Set();
  for (const review of reviews.reviews) {
    object(review, 'review');
    invariant(ID.test(review.review_id) && !reviewIds.has(review.review_id), 'review ID');
    reviewIds.add(review.review_id);
    const caseValue = caseMap.get(review.case_id);
    invariant(caseValue, `${review.review_id}: unknown case`);
    invariant(review.case_sha256 === caseValue.case_sha256, `${review.review_id}: stale case digest`);
    invariant(ID.test(review.reviewer_id), `${review.review_id}: reviewer ID`);
    invariant(reviews.policy.allowed_reviewer_roles.includes(review.reviewer_role), `${review.review_id}: reviewer role`);
    invariant(REVIEW_DECISION.has(review.decision), `${review.review_id}: decision`);
    invariant(Number.isFinite(Date.parse(review.reviewed_at)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(review.reviewed_at), `${review.review_id}: reviewed_at`);
    invariant(SHA256.test(review.evidence_sha256), `${review.review_id}: evidence digest`);
    invariant(review.disagreement_with_review_id === null || ID.test(review.disagreement_with_review_id), `${review.review_id}: disagreement`);
    const pair = `${review.case_id}:${review.reviewer_id}`;
    invariant(!reviewerPairs.has(pair), `${review.review_id}: duplicate reviewer/case`);
    reviewerPairs.add(pair);
    const payload = { ...review };
    delete payload.review_sha256;
    invariant(SHA256.test(review.review_sha256) && review.review_sha256 === sha256(payload), `${review.review_id}: review digest`);
  }
  for (const review of reviews.reviews) {
    if (review.disagreement_with_review_id !== null) {
      invariant(reviewIds.has(review.disagreement_with_review_id) && review.disagreement_with_review_id !== review.review_id, `${review.review_id}: disagreement target`);
    }
  }
}

export function computeAssessment(corpus, reviews) {
  const cases = [...corpus.platform.cases, ...corpus.agro.cases];
  const approvals = new Map(cases.map((item) => [item.case_id, []]));
  const blockers = [];
  for (const review of reviews.reviews) {
    if (review.decision === 'APPROVED') approvals.get(review.case_id).push(review);
    else blockers.push(`OPEN_${review.decision}:${review.case_id}`);
  }
  let reviewed = 0;
  const missing = [];
  for (const caseValue of cases) {
    const caseReviews = approvals.get(caseValue.case_id);
    const required = caseValue.criticality === 'CRITICAL'
      ? reviews.policy.minimum_independent_approvals_for_critical
      : reviews.policy.minimum_approvals_per_case;
    const distinct = new Set(caseReviews.map((review) => `${review.reviewer_id}:${review.reviewer_role}`));
    const roles = new Set(caseReviews.map((review) => review.reviewer_role));
    const primary = reviews.policy.required_primary_role_by_domain[caseValue.domain];
    let sufficient = distinct.size >= required && roles.has(primary);
    if (caseValue.criticality === 'CRITICAL') {
      sufficient = sufficient && reviews.policy.critical_secondary_roles.some((role) => roles.has(role));
    }
    if (sufficient) reviewed += 1;
    else missing.push(caseValue.case_id);
  }
  if (missing.length) blockers.push('EXPERT_REVIEWS_MISSING');
  const component = {
    platform_sha256: sha256(corpus.platform),
    agro_sha256: sha256(corpus.agro),
    coverage_sha256: sha256(corpus.coverage),
    reviews_sha256: sha256(reviews),
  };
  const blocking = [...new Set(blockers)].sort();
  const result = {
    schema_version: 'tai.gold-set-assessment.v1',
    version: SPEC.version,
    accepted: blocking.length === 0,
    status: blocking.length === 0 ? 'ACCEPTED' : 'PENDING_REVIEW',
    corpus_sha256: sha256(component),
    component_sha256: component,
    counts: {
      platform_cases: corpus.platform.cases.length,
      agro_cases: corpus.agro.cases.length,
      total_cases: cases.length,
      critical_cases: cases.filter((item) => item.criticality === 'CRITICAL').length,
      reviewed_cases: reviewed,
      unreviewed_cases: missing.length,
      platform_roles: corpus.platform.required_roles.length,
      deal_states: corpus.platform.required_deal_states.length,
      agro_topics: corpus.agro.required_topics.length,
      locales: corpus.platform.required_locales.length,
    },
    quality_targets: {
      platform_accuracy_minimum: 0.95,
      agro_accuracy_minimum: 0.9,
      critical_unsupported_facts_maximum: 0,
      citation_validity_minimum: 1,
    },
    blocking_reasons: blocking,
    missing_review_case_ids: missing.sort(),
  };
  result.assessment_sha256 = sha256(result);
  return result;
}

export function loadAuthority(directory = HERE) {
  return {
    reviews: parseJson(resolve(directory, 'expert-reviews.v1.json')),
    baseline: parseJson(resolve(directory, 'baseline-assessment.v1.json')),
  };
}

export function validateAuthority(directory = HERE) {
  const corpus = buildCorpus();
  const caseMap = validateCorpus(corpus);
  const { reviews, baseline } = loadAuthority(directory);
  validateReviews(reviews, caseMap);
  const assessment = computeAssessment(corpus, reviews);
  invariant(canonicalJson(assessment) === canonicalJson(baseline), 'baseline assessment does not match corpus/reviews');
  return { corpus, reviews, assessment };
}

function materialize(corpus, directory) {
  mkdirSync(directory, { recursive: true });
  const files = {
    'platform-gold.v1.json': corpus.platform,
    'agro-gold.v1.json': corpus.agro,
    'question-coverage.v1.json': corpus.coverage,
    'case-manifest.v1.json': corpus.caseManifest,
  };
  for (const [name, value] of Object.entries(files)) {
    writeFileSync(resolve(directory, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }
}

function parseArgs(argv) {
  const result = { directory: HERE, materialize: null, requireAccepted: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--directory') result.directory = resolve(argv[++index] ?? '');
    else if (arg === '--materialize') result.materialize = resolve(argv[++index] ?? '');
    else if (arg === '--require-accepted') result.requireAccepted = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return result;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const { corpus, assessment } = validateAuthority(options.directory);
  if (options.materialize) materialize(corpus, options.materialize);
  process.stdout.write(`${JSON.stringify({
    schema_version: assessment.schema_version,
    accepted: assessment.accepted,
    status: assessment.status,
    corpus_sha256: assessment.corpus_sha256,
    assessment_sha256: assessment.assessment_sha256,
    counts: assessment.counts,
    blocking_reasons: assessment.blocking_reasons,
  }, null, 2)}\n`);
  if (options.requireAccepted && !assessment.accepted) process.exitCode = 2;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export const testAssert = assertModule;
