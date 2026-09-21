#!/usr/bin/env node
/**
 * Stage the similarity comparison corpus from the installed dependency tree.
 *
 * build-offline-similarity-evidence.mjs compares the protected files against a corpus
 * mounted at IP_SIMILARITY_CORPUS, and docs/ip/similarity-corpus-approval.json binds
 * its approval to one exact aggregate digest. Without a committed way to build that
 * corpus, the similarity result is not reproducible: a reader can run the scanner but
 * cannot recreate what it was pointed at, and any restaging that differs by one file
 * invalidates the approval rather than confirming it.
 *
 * This is that missing step. It stages dependency source out of the pnpm store into a
 * flat tree of <pnpm-dir>/<path-inside-package>, where <pnpm-dir> is the store's own
 * name@version[_peerhash] directory.
 *
 * The two filters below are load-bearing and must not be "improved". They decide which
 * files enter the corpus, so changing either changes the digest and breaks the binding
 * between the approval and the scan. The extension set is deliberately narrower than
 * the scanner's own: this corpus screens hand-written dependency source, and package
 * dist/ and build/ output is excluded because a shipped bundle is not the realistic
 * origin of an undeclared copy.
 *
 * Usage: node scripts/ip/stage-similarity-corpus.mjs [destination]
 */

import { copyFileSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';

const STORE_ROOT = 'node_modules/.pnpm';
const destination = process.argv[2] ?? 'artifacts/ip-clean-room/similarity-corpus';

// Both filters are fixed by the approved corpus digest. See the header.
const EXCLUDED = /(^|\/)(tests?|fixtures?|snapshots?|node_modules|dist|build|generated)(\/|$)/iu;
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.sql', '.prisma', '.css', '.scss']);

function walk(directory, base, staged = []) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return staged;
  }
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, base, staged);
    else if (entry.isFile()) staged.push({ absolute, relative: absolute.slice(base.length + 1) });
  }
  return staged;
}

let storeEntries;
try {
  storeEntries = readdirSync(STORE_ROOT).sort((left, right) => left.localeCompare(right, 'en'));
} catch {
  console.error(`No pnpm store at ${STORE_ROOT}. Run the package install first.`);
  process.exit(2);
}

rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });

const packages = new Set();
let files = 0;

for (const packageDirectory of storeEntries) {
  const base = join(STORE_ROOT, packageDirectory, 'node_modules');
  try {
    if (!lstatSync(base).isDirectory()) continue;
  } catch {
    continue;
  }
  for (const entry of walk(base, base)) {
    if (!EXTENSIONS.has(extname(entry.relative).toLowerCase())) continue;
    const stagedPath = `${packageDirectory}/${entry.relative.replaceAll('\\', '/')}`;
    if (EXCLUDED.test(stagedPath)) continue;
    // A symlink would stage the same file twice under two names and skew the digest.
    try {
      if (!lstatSync(entry.absolute).isFile()) continue;
    } catch {
      continue;
    }
    const target = join(destination, stagedPath);
    mkdirSync(dirname(target), { recursive: true });
    try {
      copyFileSync(entry.absolute, target);
    } catch {
      continue;
    }
    packages.add(packageDirectory);
    files += 1;
  }
}

const manifest = { stagedFiles: files, packages: packages.size, destination };
writeFileSync(join(destination, '..', 'similarity-corpus-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
