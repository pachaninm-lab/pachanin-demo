#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Fails when the committed provenance record no longer describes the repository.
 *
 * docs/ip/FILE_PROVENANCE.csv, its JSON twin and CONTRIBUTORS.csv are generated
 * by build-ip-clean-room.mjs and then committed, and nothing has ever checked
 * that the committed copies still match what the builder produces. They had
 * drifted by 2976 commits and 654 files: the record said 6175 files and 605
 * CROWN_JEWEL, the repository held 6829 and 636. Every downstream number - how
 * many files a signature would unblock, how many crown jewels remain unproven -
 * was being read off a snapshot of a different tree.
 *
 * The existing gate, verify-ip-evidence.mjs, checks that a freshly built evidence
 * bundle is complete. Completeness of a fresh build says nothing about the
 * freshness of a committed one, which is why this drift survived it.
 *
 * The prose register is checked too. CHAIN_OF_TITLE_REGISTER.md states its source
 * SHA, its commit count and its CROWN_JEWEL position in its own text, and a
 * generated CSV that is current under a prose summary that is not is worse than
 * either alone: the numbers a reader quotes come from the prose.
 *
 * Two things it deliberately does not demand, both found by this gate failing on
 * its own first run against a real commit:
 *
 *   - Exact equality including the record's own rows. FILE_PROVENANCE.csv carries
 *     a blob hash for every tracked file, itself included, so it would have to
 *     contain its own hash. That is not strict, it is unsatisfiable, and a gate
 *     that can never pass is a gate that gets disabled. Rows for the record files
 *     are excluded and named, not quietly skipped.
 *   - Source SHA equal to HEAD. A record committed into the repository it
 *     describes cannot describe the commit that contains it: it is generated
 *     against the parent. The SHA must be an ancestor of HEAD, and how far HEAD
 *     has moved since is reported rather than failed on, because the content
 *     comparison is what actually detects drift.
 *
 * The stated commit total is checked for internal consistency instead of against
 * the builder, because the builder counts `rev-list --all` - every ref that
 * happens to exist when it runs. Creating a branch changes that number without
 * changing a single fact about the history, so it is context, not an invariant.
 * What must hold is that the identity table sums to the total the page states.
 */

const GENERATED = ['FILE_PROVENANCE.csv', 'FILE_PROVENANCE.json', 'CONTRIBUTORS.csv'];
const REGISTER = 'docs/ip/CHAIN_OF_TITLE_REGISTER.md';
const write = process.argv.includes('--write');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

/** "23 235" and "23235" are the same number written two ways; the register uses
 *  thin spaces for readability and the summary does not. */
export function readNumber(text) {
  const digits = String(text).replace(/\s/gu, '');
  return /^\d+$/u.test(digits) ? Number(digits) : null;
}

export function registerClaims(markdown) {
  const sourceSha = /Source SHA:\s*`([0-9a-f]{40})`/u.exec(markdown)?.[1] ?? null;
  const commits = readNumber(/History analysed:\s*([\d\s  ]+?)\s*commits/u.exec(markdown)?.[1] ?? '');
  const crownJewels = readNumber(/\*\*([\d\s  ]+?)\s*of\s*[\d\s  ]+\s*CROWN_JEWEL/u.exec(markdown)?.[1] ?? '');
  const crownJewelTotal = readNumber(/\*\*[\d\s  ]+?\s*of\s*([\d\s  ]+)\s*CROWN_JEWEL/u.exec(markdown)?.[1] ?? '');
  const identities = readNumber(/([\d\s  ]+?)\s*distinct identities/u.exec(markdown)?.[1] ?? '');
  return { sourceSha, commits, crownJewels, crownJewelTotal, identities };
}

export function compareClaims(claims, summary, sourceShaIsAncestor, identityTable) {
  const problems = [];
  if (!claims.sourceSha) {
    problems.push('register states no Source SHA');
  } else if (!sourceShaIsAncestor) {
    problems.push(`register Source SHA ${claims.sourceSha} is not an ancestor of HEAD; the record describes a history this branch is not on`);
  }
  if (claims.commits !== identityTable.sum) {
    problems.push(`register says ${claims.commits ?? 'nothing'} commits analysed, its own identity table sums to ${identityTable.sum}`);
  }
  if (claims.crownJewelTotal !== summary.crownJewelFiles) {
    problems.push(`register says ${claims.crownJewelTotal ?? 'nothing'} CROWN_JEWEL files, the builder counts ${summary.crownJewelFiles}`);
  }
  if (claims.crownJewels !== summary.crownJewelUnknownOrigin) {
    problems.push(`register says ${claims.crownJewels ?? 'nothing'} CROWN_JEWEL files of unproven origin, the builder counts ${summary.crownJewelUnknownOrigin}`);
  }
  if (claims.identities !== summary.distinctContributors) {
    problems.push(`register says ${claims.identities ?? 'nothing'} distinct identities, the builder counts ${summary.distinctContributors}`);
  }
  return problems;
}

/** The record's own rows. FILE_PROVENANCE.csv records a blob hash per tracked file
 *  and is itself tracked, so its row for itself is always one generation behind;
 *  the prose register's row moves whenever its prose is edited to match. */
export const SELF_REFERENTIAL = new Set([
  'docs/ip/FILE_PROVENANCE.csv',
  'docs/ip/FILE_PROVENANCE.json',
  'docs/ip/CONTRIBUTORS.csv',
  'docs/ip/CHAIN_OF_TITLE_REGISTER.md',
]);

/**
 * Fields that the act of recording necessarily advances.
 *
 * Committing the record is itself a commit, and it touches files. Their
 * material_contributors and evidence absorb that commit, CONTRIBUTORS.csv gains a
 * commit for whoever authored it, and last_seen moves to now. A record generated
 * before the commit cannot contain the commit that carries it, at any ordering.
 *
 * So these are compared for structure, not value, and everything else is compared
 * exactly. What the register actually asserts still fails the gate: a file
 * appearing or vanishing, an origin changing, a classification changing, a new
 * identity, a rights status moving. What is excluded is arithmetic that advances
 * whatever anybody does.
 */
export const COMMIT_ADVANCING_FIELDS = new Set(['material_contributors', 'evidence']);
export const CONTRIBUTOR_ADVANCING_FIELDS = new Set(['commit_count', 'last_seen']);

/** Drops the advancing columns so two rows are compared on what does not move. */
export function stableRow(header, line, advancing) {
  const cells = line.split(',');
  return header.map((name, index) => (advancing.has(name) ? '' : cells[index] ?? '')).join(',');
}

/** A row-level account of the drift, because "the file differs" is not a finding
 *  anybody can act on. */
export function csvDrift(committed, regenerated, advancing = new Set()) {
  const key = (line) => line.split(',', 1)[0];
  const rows = (text) => {
    const lines = text.trim().split('\n').filter(Boolean);
    const header = lines[0].split(',');
    return new Map(lines.slice(1)
      .map((line) => [key(line), stableRow(header, line, advancing)])
      .filter(([path]) => !SELF_REFERENTIAL.has(path)));
  };
  const before = rows(committed);
  const after = rows(regenerated);
  const added = [...after.keys()].filter((path) => !before.has(path));
  const removed = [...before.keys()].filter((path) => !after.has(path));
  const changed = [...after.keys()].filter((path) => before.has(path) && before.get(path) !== after.get(path));
  return { added, removed, changed };
}

/** The same exclusion for the JSON twin, which carries the identical records in a
 *  different shape. */
export function jsonDrift(committed, regenerated) {
  const index = (text) => {
    const parsed = JSON.parse(text);
    const records = Array.isArray(parsed) ? parsed : (parsed.files ?? parsed.records ?? []);
    return new Map(records
      .filter((record) => !SELF_REFERENTIAL.has(record.path))
      .map((record) => {
        const stable = { ...record };
        for (const field of COMMIT_ADVANCING_FIELDS) delete stable[field];
        return [record.path, JSON.stringify(stable)];
      }));
  };
  const before = index(committed);
  const after = index(regenerated);
  const differing = [];
  for (const [path, value] of after) if (before.get(path) !== value) differing.push(path);
  for (const path of before.keys()) if (!after.has(path)) differing.push(path);
  return differing;
}

/** The identity table must sum to the total the page states. Unlike the builder's
 *  own count this holds whatever refs exist, because both sides come from the
 *  page. */
export function identityTableSum(markdown) {
  let sum = 0;
  let rows = 0;
  for (const match of markdown.matchAll(/^\|\s*`[^`]+`\s*\|\s*([\d\s]+?)\s*\|/gmu)) {
    const value = readNumber(match[1]);
    if (value === null) continue;
    sum += value;
    rows += 1;
  }
  return { sum, rows };
}

function main() {
  const head = git(['rev-parse', 'HEAD']).trim();
  // Untracked files are ignored on purpose: the builder reads `git ls-files`, so
  // a file it cannot see cannot move its output. A modified tracked file can.
  const dirty = git(['status', '--porcelain'])
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('??'));
  if (dirty.length && !write) {
    console.error(`provenance currency: ${dirty.length} tracked file(s) modified; the builder reads the tree, so compare on a clean one.`);
    return 2;
  }

  const scratch = mkdtempSync(join(tmpdir(), 'provenance-currency-'));
  try {
    execFileSync('node', ['scripts/ip/build-ip-clean-room.mjs', scratch], { stdio: 'ignore', maxBuffer: 256 * 1024 * 1024 });
    const summary = JSON.parse(readFileSync(join(scratch, 'PROVENANCE_SUMMARY.json'), 'utf8'));

    const problems = [];
    for (const name of GENERATED) {
      const committedPath = join('docs/ip', name);
      const regenerated = readFileSync(join(scratch, name), 'utf8');
      if (!existsSync(committedPath)) { problems.push(`${name} is not committed`); continue; }
      const committed = readFileSync(committedPath, 'utf8');
      if (sha256(committed) === sha256(regenerated)) continue;
      if (name.endsWith('.csv')) {
        const advancing = name === 'CONTRIBUTORS.csv' ? CONTRIBUTOR_ADVANCING_FIELDS : COMMIT_ADVANCING_FIELDS;
        const drift = csvDrift(committed, regenerated, advancing);
        if (drift.added.length || drift.removed.length || drift.changed.length) {
          problems.push(`${name}: ${drift.added.length} row(s) added, ${drift.removed.length} removed, ${drift.changed.length} changed`);
        }
      } else {
        const drift = jsonDrift(committed, regenerated);
        if (drift.length) problems.push(`${name}: ${drift.length} record(s) differ from a fresh build`);
      }
      if (write) writeFileSync(committedPath, regenerated);
    }

    const markdown = readFileSync(REGISTER, 'utf8');
    const claims = registerClaims(markdown);
    let ancestor = false;
    let behind = 0;
    if (claims.sourceSha) {
      try {
        execFileSync('git', ['merge-base', '--is-ancestor', claims.sourceSha, 'HEAD'], { stdio: 'ignore' });
        ancestor = true;
        behind = Number(git(['rev-list', '--count', `${claims.sourceSha}..HEAD`]).trim());
      } catch { ancestor = false; }
    }
    problems.push(...compareClaims(claims, summary, ancestor, identityTableSum(markdown)));

    if (!problems.length) {
      console.log(`provenance currency: committed record matches a fresh build of the tree at ${head.slice(0, 12)}`);
      console.log(`  ${summary.trackedFiles} files, ${summary.crownJewelFiles} CROWN_JEWEL, ${summary.distinctContributors} identities`);
      console.log(`  generated against ${claims.sourceSha.slice(0, 12)}, ${behind} commit(s) behind HEAD; ${SELF_REFERENTIAL.size} self-referential row(s) excluded`);
      return 0;
    }
    console.error('provenance currency: the committed record no longer describes this repository');
    for (const problem of problems) console.error(`  - ${problem}`);
    if (write) {
      console.error('  generated files rewritten; the prose register is written by hand and is not rewritten here.');
      return 1;
    }
    console.error('  regenerate with: node scripts/ip/verify-provenance-currency.mjs --write');
    return 1;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
