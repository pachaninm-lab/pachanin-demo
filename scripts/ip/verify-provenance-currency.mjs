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

export function compareClaims(claims, summary, head) {
  const problems = [];
  if (claims.sourceSha !== head) {
    problems.push(`register Source SHA is ${claims.sourceSha ?? 'absent'}, repository head is ${head}`);
  }
  if (claims.commits !== summary.repositoryHistoryCommits) {
    problems.push(`register says ${claims.commits ?? 'nothing'} commits analysed, the builder counts ${summary.repositoryHistoryCommits}`);
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

/** A row-level account of the drift, because "the file differs" is not a finding
 *  anybody can act on. */
export function csvDrift(committed, regenerated) {
  const key = (line) => line.split(',', 1)[0];
  const before = new Map(committed.trim().split('\n').slice(1).filter(Boolean).map((line) => [key(line), line]));
  const after = new Map(regenerated.trim().split('\n').slice(1).filter(Boolean).map((line) => [key(line), line]));
  const added = [...after.keys()].filter((path) => !before.has(path));
  const removed = [...before.keys()].filter((path) => !after.has(path));
  const changed = [...after.keys()].filter((path) => before.has(path) && before.get(path) !== after.get(path));
  return { added, removed, changed };
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
        const drift = csvDrift(committed, regenerated);
        problems.push(`${name}: ${drift.added.length} row(s) added, ${drift.removed.length} removed, ${drift.changed.length} changed`);
      } else {
        problems.push(`${name}: content differs from a fresh build`);
      }
      if (write) writeFileSync(committedPath, regenerated);
    }

    const claims = registerClaims(readFileSync(REGISTER, 'utf8'));
    problems.push(...compareClaims(claims, summary, head));

    if (!problems.length) {
      console.log(`provenance currency: committed record matches a fresh build at ${head.slice(0, 12)}`);
      console.log(`  ${summary.trackedFiles} files, ${summary.repositoryHistoryCommits} commits, ${summary.crownJewelFiles} CROWN_JEWEL, ${summary.distinctContributors} identities`);
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
