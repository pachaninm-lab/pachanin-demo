import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ASVS_SOURCE_COMMIT,
  ASVS_SOURCE_SHA256,
  ASVS_VERSION,
  EXPECTED_REQUIREMENTS,
  buildMatrixCsv,
  buildSummary,
  csvCell,
  evaluateCondition,
  isOpaqueDataModule,
  validateStandard,
  verifyPinnedSourceDigest,
} from './build-asvs-matrix.mjs';

function syntheticStandard(count = EXPECTED_REQUIREMENTS) {
  return {
    requirements: Array.from({ length: count }, (_, index) => ({
      chapter_id: 'V1',
      chapter_name: 'Synthetic',
      section_id: 'V1.1',
      section_name: 'Synthetic section',
      req_id: `V1.1.${index + 1}`,
      req_description: `Synthetic requirement prose ${index + 1}`,
      L: String((index % 3) + 1),
    })),
  };
}

test('validates and deterministically inventories the complete requirement set without prose', () => {
  const source = syntheticStandard();
  const first = validateStandard(source);
  const second = validateStandard(structuredClone(source));
  const firstCsv = buildMatrixCsv(first);
  const secondCsv = buildMatrixCsv(second);

  assert.equal(first.length, EXPECTED_REQUIREMENTS);
  assert.equal(firstCsv, secondCsv);
  assert.match(firstCsv, new RegExp(`"${ASVS_VERSION}"`));
  assert.match(firstCsv, new RegExp(`"${ASVS_SOURCE_COMMIT}"`));
  assert.doesNotMatch(firstCsv, /Synthetic requirement prose/u);
  assert.equal(firstCsv.trimEnd().split('\n').length, EXPECTED_REQUIREMENTS + 1);
});

test('rejects a duplicate requirement id', () => {
  const source = syntheticStandard();
  source.requirements[1].req_id = source.requirements[0].req_id;
  assert.throws(() => validateStandard(source), /duplicate requirement id/u);
});

test('rejects a malformed requirement id', () => {
  const source = syntheticStandard();
  source.requirements[0].req_id = '1.1.1';
  assert.throws(() => validateStandard(source), /requirement id invalid/u);
});

test('rejects an invalid level', () => {
  const source = syntheticStandard();
  source.requirements[0].L = '4';
  assert.throws(() => validateStandard(source), /requirement level invalid/u);
});

test('rejects an incomplete requirement count', () => {
  assert.throws(() => validateStandard(syntheticStandard(EXPECTED_REQUIREMENTS - 1)), /requirement count mismatch/u);
});

test('rejects malformed upstream schema and missing descriptions', () => {
  assert.throws(() => validateStandard({ Requirements: [] }), /top-level requirements array/u);
  const source = syntheticStandard();
  source.requirements[0].req_description = '';
  assert.throws(() => validateStandard(source), /description missing/u);
});

test('escapes CSV cells without leaking structure', () => {
  assert.equal(csvCell('a"b,c'), '"a""b,c"');
});

test('rejects source bytes that do not match the pinned upstream SHA-256', () => {
  assert.match(ASVS_SOURCE_SHA256, /^[0-9a-f]{64}$/u);
  assert.throws(
    () => verifyPinnedSourceDigest(Buffer.from('not-the-pinned-asvs-source', 'utf8')),
    /source digest mismatch/u,
  );
});

test('summary is deterministic, source-digested, and cannot claim a final pass', () => {
  const requirements = validateStandard(syntheticStandard());
  const matrix = buildMatrixCsv(requirements);
  const sourceBytes = Buffer.from('{"public":"standard"}', 'utf8');
  const summary = buildSummary(requirements, matrix, {
    sourceBytes,
    repositorySourceSha: 'a'.repeat(40),
  });

  assert.equal(summary.requirements, EXPECTED_REQUIREMENTS);
  assert.equal(summary.statusCounts.NOT_ASSESSED, EXPECTED_REQUIREMENTS);
  assert.equal(summary.proprietarySourceUploaded, false);
  assert.equal(summary.outputContainsRequirementDescriptions, false);
  assert.equal(summary.finalPass, false);
  // NOT_ASSESSED now counts requirements decided APPLICABLE but not yet
  // assessed. While every requirement is still pending an applicability
  // decision, that category is empty and PENDING alone is the blocker - the
  // same 345 requirements, counted once rather than twice.
  assert.deepEqual(summary.blockers, [`PENDING_APPLICABILITY_REVIEW:${EXPECTED_REQUIREMENTS}`]);
  assert.equal(summary.matrixSha256, createHash('sha256').update(matrix, 'utf8').digest('hex'));
  assert.equal(summary.sourceSha256, createHash('sha256').update(sourceBytes).digest('hex'));
});

// PRESENT_AT_PATH and ABSENT_AT_PATH bind a decision to named files. The tests
// below use a synthetic tree so they assert the primitive, not the repository.
const pathContext = (files) => ({
  tracked: Object.keys(files),
  readFile: (path) => files[path] ?? null,
});

test('PRESENT_AT_PATH holds only when every named path carries the control', () => {
  const files = {
    'a/route.ts': 'const MAX_FILE_BYTES = 8;',
    'b/route.ts': 'export const runtime = "nodejs";',
  };
  const both = evaluateCondition({
    condition: 'size cap present', check: 'PRESENT_AT_PATH',
    paths: ['a/route.ts', 'b/route.ts'], patterns: ['max_file_bytes'],
  }, pathContext(files));
  assert.equal(both.holds, false, 'a partial result must not satisfy PRESENT_AT_PATH');

  const one = evaluateCondition({
    condition: 'size cap present', check: 'PRESENT_AT_PATH',
    paths: ['a/route.ts'], patterns: ['max_file_bytes'],
  }, pathContext(files));
  assert.equal(one.holds, true);
});

test('PRESENT_AT_PATH treats several patterns as alternatives, PRESENT_ALL_AT_PATH as combined evidence', () => {
  // The real case this came from: a condition claiming a verifier both checks a
  // signature and rejects an invalid one. With .some(), deleting the rejection
  // leaves the decision standing on the half that remains.
  const halfGone = { 'a/verify.ts': 'const valid = await crypto.subtle.verify(alg, key, sig, body);\nreturn payload;' };
  const intact = { 'a/verify.ts': 'const valid = await crypto.subtle.verify(alg, key, sig, body);\nif (!valid) return null;\nreturn payload;' };
  const patterns = ['crypto.subtle.verify', 'if (!valid) return null'];

  const anyOf = { condition: 'verified and rejected', check: 'PRESENT_AT_PATH', paths: ['a/verify.ts'], patterns };
  assert.equal(evaluateCondition(anyOf, pathContext(intact)).holds, true);
  assert.equal(
    evaluateCondition(anyOf, pathContext(halfGone)).holds,
    true,
    'PRESENT_AT_PATH is an OR: this is why a condition meaning AND must not use it',
  );

  const allOf = { ...anyOf, check: 'PRESENT_ALL_AT_PATH' };
  assert.equal(evaluateCondition(allOf, pathContext(intact)).holds, true);
  assert.equal(
    evaluateCondition(allOf, pathContext(halfGone)).holds,
    false,
    'PRESENT_ALL_AT_PATH revokes the decision as soon as one of the named facts goes',
  );
});

test('PRESENT_ALL_AT_PATH needs every pattern in every named path, not one each', () => {
  // The other half of the same defect: with .some() and two paths, each file
  // matching a different pattern satisfies the condition, so a claim of "both
  // facts on both paths" is only ever checked along the diagonal.
  const split = {
    'a/one.ts': "if (session_status === 'revoked') throw new Error();",
    'b/two.ts': "if (session_status === 'expired') throw new Error();",
  };
  const patterns = ["session_status === 'revoked'", "session_status === 'expired'"];
  const paths = ['a/one.ts', 'b/two.ts'];

  assert.equal(
    evaluateCondition({ condition: 'both statuses on both paths', check: 'PRESENT_AT_PATH', paths, patterns }, pathContext(split)).holds,
    true,
    'the OR check is satisfied by a diagonal, which is what makes it misleading here',
  );
  assert.equal(
    evaluateCondition({ condition: 'both statuses on both paths', check: 'PRESENT_ALL_AT_PATH', paths, patterns }, pathContext(split)).holds,
    false,
  );

  const complete = {
    'a/one.ts': "if (session_status === 'revoked' || session_status === 'expired') throw new Error();",
    'b/two.ts': "if (session_status === 'expired' || session_status === 'revoked') throw new Error();",
  };
  assert.equal(
    evaluateCondition({ condition: 'both statuses on both paths', check: 'PRESENT_ALL_AT_PATH', paths, patterns }, pathContext(complete)).holds,
    true,
  );
});

test('PRESENT_ALL_AT_PATH keeps the missing-path and empty-pattern guards', () => {
  const gone = evaluateCondition({
    condition: 'control lives here', check: 'PRESENT_ALL_AT_PATH',
    paths: ['apps/gone/route.ts'], patterns: ['a', 'b'],
  }, pathContext({ 'apps/here/route.ts': 'ab' }));
  assert.equal(gone.holds, false);
  assert.match(gone.evidence, /path not tracked/u);

  const noPatterns = evaluateCondition({
    condition: 'declares nothing', check: 'PRESENT_ALL_AT_PATH',
    paths: ['a/route.ts'], patterns: [],
  }, pathContext({ 'a/route.ts': 'anything' }));
  assert.equal(noPatterns.holds, false);
});

test('a decision pointing at a path that no longer exists stops holding', () => {
  const moved = evaluateCondition({
    condition: 'control lives here', check: 'PRESENT_AT_PATH',
    paths: ['apps/gone/route.ts'], patterns: ['max_file_bytes'],
  }, pathContext({ 'apps/here/route.ts': 'const MAX_FILE_BYTES = 8;' }));

  assert.equal(moved.holds, false);
  assert.match(moved.evidence, /path not tracked/u);
});

test('ABSENT_AT_PATH makes a FAIL self-revoking once the gap is closed', () => {
  const gap = { condition: 'no decompression ceiling', check: 'ABSENT_AT_PATH', paths: ['a/route.ts'], patterns: ['maxoutputlength'] };

  const open = evaluateCondition(gap, pathContext({ 'a/route.ts': 'inflateRawSync(compressed);' }));
  assert.equal(open.holds, true, 'while the gap is open the FAIL stands');

  const closed = evaluateCondition(gap, pathContext({ 'a/route.ts': 'inflateRawSync(compressed, { maxOutputLength: 4096 });' }));
  assert.equal(closed.holds, false, 'once the gap is closed the FAIL must stop holding');
  assert.match(closed.evidence, /gap closed in a\/route\.ts/u);
});

test('a path-bound condition with no paths declared does not hold', () => {
  const empty = evaluateCondition({
    condition: 'names nothing', check: 'PRESENT_AT_PATH', paths: [], patterns: ['anything'],
  }, pathContext({ 'a/route.ts': 'anything' }));
  assert.equal(empty.holds, false);
  assert.match(empty.evidence, /declares no paths/u);
});

test('an over-broad absence pattern fails safe rather than passing silently', () => {
  // Drafting the token decisions, an absence condition listed the three-letter
  // pattern "jku" to prove no token-directed key resolution exists. It matched
  // base64 image data in an unrelated component. The condition stopped holding
  // and the decision was rejected - the safe direction. A mechanism that
  // resolved this the other way would let a sloppy pattern manufacture evidence.
  const files = {
    'apps/a/logo.ts': "const asset = 'FBRBGlW49KpduOCSi2DDGmtefCGmLj4Hf3LdL6E7M9MwTzQQO9f5pAmETRKyARncoPFKjkUUa3JCslSn';",
  };
  const overBroad = evaluateCondition({
    condition: 'no token-directed key resolution', check: 'ABSENT_IN_TREE',
    patterns: ['jku'], roots: ['apps'],
  }, pathContext(files));

  assert.equal(overBroad.holds, false, 'an accidental match must invalidate the condition');

  const precise = evaluateCondition({
    condition: 'no token-directed key resolution', check: 'ABSENT_IN_TREE',
    patterns: ['createremotejwkset', 'header.kid'], roots: ['apps'],
  }, pathContext(files));
  assert.equal(precise.holds, true);
});

test('NO_RUNTIME_CALLER distinguishes a wired control from one nothing invokes', () => {
  // The case that motivated this check: a complete, tested policy that the
  // running application never calls. Reading the policy module alone cannot
  // tell that apart from a control that works.
  const files = {
    'apps/api/src/auth/authority.policy.ts': 'export function evaluateGrant() { return true; }',
    'apps/api/src/auth/authority.policy.spec.ts': 'evaluateGrant();',
    'apps/api/src/deals/deals.service.ts': 'const ok = somethingElse();',
  };
  const orphan = evaluateCondition({
    condition: 'the policy is never invoked at runtime', check: 'NO_RUNTIME_CALLER',
    patterns: ['evaluategrant'], roots: ['apps'],
    definedAt: ['apps/api/src/auth/authority.policy.ts'],
  }, pathContext(files));

  assert.equal(orphan.holds, true, 'a symbol used only by its own tests has no runtime caller');
  assert.match(orphan.evidence, /no caller/u);

  const wired = evaluateCondition({
    condition: 'the policy is never invoked at runtime', check: 'NO_RUNTIME_CALLER',
    patterns: ['evaluategrant'], roots: ['apps'],
    definedAt: ['apps/api/src/auth/authority.policy.ts'],
  }, pathContext({
    ...files,
    'apps/api/src/deals/deals.service.ts': 'const ok = evaluateGrant(input);',
  }));

  assert.equal(wired.holds, false, 'one real caller must end the claim');
  assert.match(wired.evidence, /called from apps\/api\/src\/deals\/deals\.service\.ts/u);
});

test('NO_RUNTIME_CALLER does not count the defining module as its own caller', () => {
  const selfOnly = evaluateCondition({
    condition: 'never invoked', check: 'NO_RUNTIME_CALLER',
    patterns: ['evaluategrant'], roots: ['apps'],
    definedAt: ['apps/api/src/auth/authority.policy.ts'],
  }, pathContext({
    'apps/api/src/auth/authority.policy.ts': 'export function evaluateGrant() {} evaluateGrant();',
  }));
  assert.equal(selfOnly.holds, true);
});

// The unit tests above prove the primitive. This one proves the register that
// uses it: every conjunctive condition must actually hold today, and must stop
// holding if any single fact it names disappears. Both defects that produced
// this check - patterns joined by .some(), and a pattern matching an import
// rather than a call - were invisible to reading the condition and only showed
// up when a fact was removed, so the property is asserted rather than reviewed.
test('every PRESENT_ALL_AT_PATH condition in the register holds and is revocable', () => {
  const register = JSON.parse(readFileSync('docs/security/asvs-applicability-decisions.json', 'utf8'));
  const tracked = execFileSync('git', ['ls-files']).toString().split('\n').filter(Boolean);
  const real = (path) => { try { return readFileSync(path, 'utf8'); } catch { return null; } };

  const stripAll = (text, needle) => {
    const hay = text.toLowerCase();
    const pin = needle.toLowerCase();
    let out = '';
    let cursor = 0;
    for (;;) {
      const at = hay.indexOf(pin, cursor);
      if (at === -1) return out + text.slice(cursor);
      out += `${text.slice(cursor, at)}__FACT_REMOVED__`;
      cursor = at + pin.length;
    }
  };

  const conjunctive = register.decisions.flatMap((decision) => (decision.conditions ?? [])
    .filter((condition) => condition.check === 'PRESENT_ALL_AT_PATH')
    .map((condition) => [decision.requirementId, condition]));

  assert.ok(conjunctive.length > 0, 'the register should carry conjunctive conditions once they are migrated');

  for (const [requirementId, condition] of conjunctive) {
    assert.equal(
      evaluateCondition(condition, { tracked, readFile: real }).holds,
      true,
      `${requirementId}: conjunctive condition does not hold against the live tree`,
    );

    for (const pattern of condition.patterns) {
      for (const path of condition.paths) {
        const source = real(path);
        if (!source || !source.toLowerCase().includes(pattern.toLowerCase())) continue;
        const readFile = (candidate) => (candidate === path ? stripAll(source, pattern) : real(candidate));
        assert.equal(
          evaluateCondition(condition, { tracked, readFile }).holds,
          false,
          `${requirementId}: removing ${JSON.stringify(pattern)} from ${path} left the condition holding`,
        );
      }
    }
  }
});

/**
 * #4764. A committed base64 payload is data, and substring-scanning it revoked
 * two unrelated decisions by chance: `jwks` inside the presentation PDF's
 * part-12, `sgx` inside parts 04, 07 and 08. Both sides are lowercased, so every
 * case variant collides and a four-character pattern is near certain to hit
 * 265 KB of base64.
 */
const PAYLOAD = 'export const PRESENTATION_PART_12 =\n  "LAxMldwA24cqaOJWKS4LTSqnAl7OyXSGX7uTC";\n';

test('a tree scan ignores a file proven to be one opaque exported literal', () => {
  const result = evaluateCondition(
    { condition: 'no JWKS verifier', check: 'ABSENT_IN_TREE', roots: ['apps'], patterns: ['jwks', 'sgx'] },
    { tracked: ['apps/web/lib/presentation-pdf/part-12.ts'], readFile: () => PAYLOAD },
  );
  assert.equal(result.holds, true, 'base64 payload must not revoke a decision');
});

test('a tree scan still reports the same patterns when they appear in real code', () => {
  const code = 'import { createRemoteJWKSet } from "jose";\nexport const verifier = createRemoteJWKSet(url);\n';
  const result = evaluateCondition(
    { condition: 'no JWKS verifier', check: 'ABSENT_IN_TREE', roots: ['apps'], patterns: ['jwks'] },
    { tracked: ['apps/api/src/verify.ts'], readFile: () => code },
  );
  assert.equal(result.holds, false, 'a real JWKS verifier must still revoke the decision');
});

test('the data-payload exemption cannot hide executable code', () => {
  for (const smuggled of [
    'export const X = "AAAA";\nimport fs from "node:fs";\n',
    'export const X = "AAAA"; doThing();\n',
    'export const X = "AAAA";\nexport function jwksVerify() {}\n',
  ]) {
    assert.equal(isOpaqueDataModule(smuggled), false, `must not exempt: ${smuggled}`);
    const result = evaluateCondition(
      { condition: 'no caller', check: 'ABSENT_IN_TREE', roots: ['apps'], patterns: ['import', 'dothing', 'jwks'] },
      { tracked: ['apps/web/lib/payload.ts'], readFile: () => smuggled },
    );
    assert.equal(result.holds, false, 'a file with any code in it must still be scanned');
  }
});

test('NO_RUNTIME_CALLER is exempted on the same proven-data basis', () => {
  const result = evaluateCondition(
    {
      condition: 'no runtime caller',
      check: 'NO_RUNTIME_CALLER',
      roots: ['apps'],
      definedAt: ['apps/api/src/policy.ts'],
      patterns: ['sgx'],
    },
    { tracked: ['apps/web/lib/presentation-pdf/part-04.ts'], readFile: () => PAYLOAD },
  );
  assert.equal(result.holds, true, 'base64 must not read as a runtime caller');
});
