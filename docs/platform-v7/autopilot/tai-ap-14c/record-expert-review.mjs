#!/usr/bin/env node
/**
 * Append one expert review record to `expert-reviews.v1.json`.
 *
 * This computes the two digests a reviewer cannot reasonably compute by hand — the
 * case digest binding and `review_sha256` — and nothing else. It does not decide, it
 * does not summarise, and it refuses to run without a real evidence file on disk
 * that a named human produced. A review record this script writes is exactly the
 * decision a person handed it.
 *
 * Usage:
 *
 *   node record-expert-review.mjs \
 *     --case platform.role.bank \
 *     --reviewer-id reviewer.ivanov \
 *     --role PLATFORM_OWNER \
 *     --decision APPROVED \
 *     --evidence /path/to/signed-review-note.pdf \
 *     [--disagreement-with review.platform.role.bank.reviewer.petrov] \
 *     [--dry-run]
 *
 * The evidence file is hashed, not copied: raw review notes stay out of Git and the
 * record keeps only the digest, so the note can be produced later and checked.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REVIEWS_PATH = resolve(HERE, 'expert-reviews.v1.json');
const ID = /^[A-Za-z0-9._:-]{1,200}$/;
const DECISIONS = new Set(['APPROVED', 'REJECTED', 'NEEDS_CHANGES']);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

/** Byte-identical to gold-set-authority.mjs. Both must agree or every digest is wrong. */
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) fail('undefined is not valid canonical JSON');
  return encoded;
}

function sha256(value) {
  const input = typeof value === 'string' ? value : canonicalJson(value);
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function parseArguments(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) fail(`unexpected argument: ${token}`);
    const key = token.slice(2);
    if (key === 'dry-run') {
      parsed.dryRun = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) fail(`--${key} requires a value`);
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

const args = parseArguments(process.argv.slice(2));

for (const required of ['case', 'reviewer-id', 'role', 'decision', 'evidence']) {
  if (!args[required]) fail(`--${required} is required`);
}

const caseId = args.case;
const reviewerId = args['reviewer-id'];
const reviewerRole = args.role;
const decision = args.decision;

if (!ID.test(caseId)) fail('case id must match ^[A-Za-z0-9._:-]{1,200}$');
if (!ID.test(reviewerId)) fail('reviewer id must match ^[A-Za-z0-9._:-]{1,200}$');
if (!DECISIONS.has(decision)) fail(`decision must be one of ${[...DECISIONS].join(', ')}`);

// The evidence file must exist. A review with no artefact behind it is an assertion,
// and this file is the only thing that lets a third party re-check the decision later.
let evidenceBytes;
try {
  evidenceBytes = readFileSync(args.evidence);
} catch (error) {
  fail(`evidence file could not be read: ${args.evidence} (${error.code ?? error.message})`);
}
if (evidenceBytes.length === 0) fail('evidence file is empty');

const reviews = JSON.parse(readFileSync(REVIEWS_PATH, 'utf8'));
if (!reviews.policy.allowed_reviewer_roles.includes(reviewerRole)) {
  fail(`role must be one of ${reviews.policy.allowed_reviewer_roles.join(', ')}`);
}

// Bind to the case digest as it stands right now. If the case is later edited its
// digest changes and gold-set-authority.mjs rejects this record as stale — which is
// the intended behaviour, not a bug to work around.
const { buildCorpus } = await import('./gold-set-authority.mjs');
const corpus = buildCorpus();
const target = [...corpus.platform.cases, ...corpus.agro.cases].find(
  (entry) => entry.case_id === caseId,
);
if (!target) fail(`unknown case: ${caseId}`);

if (reviews.reviews.some((review) => review.case_id === caseId && review.reviewer_id === reviewerId)) {
  fail(`${reviewerId} has already reviewed ${caseId}; one reviewer counts once per case`);
}

const record = {
  review_id: `review.${caseId}.${reviewerId}`,
  case_id: caseId,
  case_sha256: target.case_sha256,
  reviewer_id: reviewerId,
  reviewer_role: reviewerRole,
  decision,
  reviewed_at: new Date().toISOString(),
  evidence_sha256: createHash('sha256').update(evidenceBytes).digest('hex'),
  disagreement_with_review_id: args['disagreement-with'] ?? null,
};
record.review_sha256 = sha256(record);

if (args.dryRun) {
  process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
  process.stdout.write('dry run: nothing written\n');
  process.exit(0);
}

reviews.reviews.push(record);
reviews.reviews.sort((left, right) => left.review_id.localeCompare(right.review_id));
writeFileSync(REVIEWS_PATH, `${JSON.stringify(reviews, null, 2)}\n`, 'utf8');
process.stdout.write(`${record.review_id} recorded (${decision})\n`);
process.stdout.write(
  `${reviews.reviews.length} review record(s) on file. Re-run gold-set-authority.mjs --require-accepted to see remaining coverage.\n`,
);
