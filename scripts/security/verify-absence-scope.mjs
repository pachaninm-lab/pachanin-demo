#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Fails when an absence that carries a PASS holds only because of where the
 * roots were drawn.
 *
 * ABSENT_IN_TREE says a pattern does not occur under a list of roots. A reader
 * takes that as "this repository does not do that". Sometimes it means "this
 * repository does that somewhere else". V1.1.2 and V3.2.2 pass on
 * dangerouslySetInnerHTML being absent from apps/web/lib while 23 files under
 * apps/web/app and apps/web/components use it, three of them in layout.tsx.
 * V1.2.4 passes on queryRawUnsafe being absent from apps/api/src while two
 * scripts under apps/api/scripts call $executeRawUnsafe with template-literal
 * SQL. Both scopes are arguable. Neither was stated.
 *
 * So the rule is not "widen the roots" - that would flip verdicts on an argument
 * nobody has had. It is: if the pattern occurs outside its roots, the condition
 * must say why those roots are the right ones, in a `scopedAbsence` field a
 * reader can weigh. An unexplained one fails.
 *
 * Three kinds of occurrence are not counted, because none of them is the
 * codebase doing the thing:
 *   - the register, the scope manifests and these scripts, which carry every
 *     pattern as data and would make every condition look violated;
 *   - tests and specs, which name a hazard in order to prove it is refused;
 *   - files under the condition's own roots, which is what ABSENT_IN_TREE
 *     already checks and the matrix builder already enforces.
 */

const SELF_REFERENTIAL = /^(docs\/security\/asvs-applicability-decisions\.json|docs\/platform-v7\/autopilot\/scopes\/|scripts\/security\/|scripts\/ip\/|docs\/security\/ASVS_)/u;
const TEST_PATH = /(^|\/)(tests?|__tests__)\/|\.(test|spec|e2e-spec)\.[jt]sx?$/u;
const READABLE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.sql', '.json', '.md', '.css', '.scss', '.yml', '.yaml', '.sh', '.prisma']);
/** Absence carries these verdicts. On a FAIL or a NOT_ASSESSED it is not what
 *  anybody is relying on. */
const FAVOURABLE = new Set(['PASS']);

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

export function isExcluded(path, roots) {
  if (SELF_REFERENTIAL.test(path)) return true;
  if (TEST_PATH.test(path)) return true;
  return roots.some((root) => path === root || path.startsWith(`${root.replace(/\/+$/u, '')}/`));
}

export function outsideOccurrences(pattern, roots, files, read) {
  const needle = pattern.toLowerCase();
  const hits = [];
  for (const path of files) {
    if (isExcluded(path, roots)) continue;
    const text = read(path);
    if (text !== null && text.toLowerCase().includes(needle)) hits.push(path);
  }
  return hits;
}

function main() {
  const decisions = JSON.parse(readFileSync('docs/security/asvs-applicability-decisions.json', 'utf8')).decisions ?? [];
  const files = git(['ls-files', '-z']).split('\0')
    .filter(Boolean)
    .filter((path) => READABLE.has(extname(path).toLowerCase()));
  const cache = new Map();
  const read = (path) => {
    if (!cache.has(path)) {
      try { cache.set(path, readFileSync(path, 'utf8')); } catch { cache.set(path, null); }
    }
    return cache.get(path);
  };

  const unjustified = [];
  const justified = [];
  const advisory = [];
  for (const decision of decisions) {
    for (const condition of decision.conditions ?? []) {
      if (condition.check !== 'ABSENT_IN_TREE') continue;
      const roots = condition.roots ?? [];
      for (const pattern of condition.patterns ?? []) {
        const hits = outsideOccurrences(pattern, roots, files, read);
        if (!hits.length) continue;
        const entry = { requirementId: decision.requirementId, status: decision.status, pattern, roots, outside: hits.length, example: hits[0] };
        if (!FAVOURABLE.has(decision.status)) { advisory.push(entry); continue; }
        if (String(condition.scopedAbsence ?? '').trim().length >= 20) justified.push(entry);
        else unjustified.push(entry);
      }
    }
  }

  console.log(`absence scope: ${justified.length + unjustified.length} PASS-carrying absence(s) occur outside their roots; ${justified.length} explained`);
  if (advisory.length) {
    console.log(`  ${advisory.length} more on non-PASS decisions, reported and not blocking:`);
    for (const entry of advisory) console.log(`    ${entry.requirementId} (${entry.status}) ${JSON.stringify(entry.pattern)} x${entry.outside} e.g. ${entry.example}`);
  }
  if (!unjustified.length) return 0;
  console.error(`absence scope FAILED: ${unjustified.length} absence(s) carry a PASS without saying why their roots are the right scope`);
  for (const entry of unjustified) {
    console.error(`- ${entry.requirementId} ${JSON.stringify(entry.pattern)} roots=${JSON.stringify(entry.roots)} occurs in ${entry.outside} file(s) outside, e.g. ${entry.example}`);
  }
  console.error('  Add scopedAbsence to the condition explaining why, or widen the roots.');
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
