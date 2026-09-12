#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Builds a similarity corpus out of the dependencies this repository already has.
 *
 * The originality half of the IP programme had never produced a number. Its
 * screening tool was written and correct, and it had never run against anything:
 * status CORPUS_REQUIRED, blocker APPROVED_OFFLINE_EXTERNAL_CORPUS_NOT_PROVIDED.
 * A comparison against nothing answers nothing, so "is the core original" stood
 * unmeasured rather than unfavourable.
 *
 * One corpus needs no approval to obtain and no network to fetch: the packages
 * we depend on are already on disk. That is also the likeliest way third-party
 * code reaches a first-party module by accident - somebody pastes a helper out
 * of a library instead of calling it. It does not answer the whole question, and
 * the report says so; it answers the part that can be answered today.
 *
 * Three details decide whether the corpus is usable at all, and each was found
 * by the screening tool refusing the first attempt:
 *
 *   - pnpm stores packages at .pnpm/<id>/node_modules/<name>, and the screening
 *     tool excludes any path containing a node_modules segment - correctly, since
 *     it must not scan our own installed tree. Pointed at the store directly it
 *     would exclude everything and report a clean run over an empty corpus. The
 *     packages are therefore re-rooted to <id>__<name>/... with no such segment.
 *   - The tool requires every corpus entry to be a regular file and blocks on
 *     anything else. Package trees are full of symlinks; they are dropped.
 *   - Copying 1.2 GB would be pointless, so entries are hard-linked. Same
 *     content, same inode, no second copy.
 */

const OUT = process.argv[2] ?? 'artifacts/ip-clean-room/dependency-corpus';
const STORE = process.argv[3] ?? 'node_modules/.pnpm';

function linkTree(from, to) {
  // cp -al is a hard-link copy: instant, and it shares inodes with the store.
  try {
    execFileSync('cp', ['-al', from, to], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function dropNonRegular(root) {
  let dropped = 0;
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (!entry.isFile()) { unlinkSync(absolute); dropped += 1; }
    }
  };
  walk(root);
  return dropped;
}

export function packageDirectories(store) {
  const roots = [];
  if (!existsSync(store)) return roots;
  for (const id of readdirSync(store)) {
    const inner = join(store, id, 'node_modules');
    if (!existsSync(inner)) continue;
    for (const name of readdirSync(inner)) {
      if (name === '.bin') continue;
      if (name.startsWith('@')) {
        const scope = join(inner, name);
        if (!lstatSync(scope).isDirectory()) continue;
        for (const scoped of readdirSync(scope)) {
          roots.push({ id, name: `${name}/${scoped}`, path: join(scope, scoped) });
        }
        continue;
      }
      const path = join(inner, name);
      if (lstatSync(path).isDirectory()) roots.push({ id, name, path });
    }
  }
  return roots;
}

/** `<id>__<name>` with no path separator, so no node_modules segment survives. */
export function corpusEntryName(id, name) {
  return `${id}__${name.replaceAll('/', '__')}`;
}

function main() {
  const out = resolve(OUT);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const packages = packageDirectories(STORE);
  let linked = 0;
  for (const pkg of packages) {
    const destination = join(out, corpusEntryName(pkg.id, pkg.name));
    if (existsSync(destination)) continue;
    if (!lstatSync(pkg.path).isDirectory()) continue;
    if (linkTree(pkg.path, destination)) linked += 1;
  }

  const dropped = dropNonRegular(out);
  let files = 0;
  const count = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) count(join(directory, entry.name));
      else if (entry.isFile()) files += 1;
    }
  };
  count(out);

  console.log(`DEPENDENCY_CORPUS: ${linked} package(s) linked from ${STORE}, ${files} regular file(s), ${dropped} non-regular entr(ies) dropped`);
  console.log(`  ${out}`);
  console.log('  Hard links: the corpus shares inodes with the store and costs no additional space.');
  if (linked === 0) {
    console.error('DEPENDENCY_CORPUS: FAIL - no package linked; is the dependency store installed?');
    return 1;
  }
  if (statSync(out).isDirectory() === false) return 1;
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
