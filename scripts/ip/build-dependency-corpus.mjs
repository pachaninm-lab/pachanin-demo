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
 *
 * A fourth detail was found only after the first run had already been published,
 * by the run's own numbers rather than by review: 151 of the 688 protected files
 * are Python, and the npm store holds one .py file in total. Those 151 files had
 * been screened against nothing and reported clean, which is the failure mode
 * this corpus exists to avoid - a tool pointed at a structurally unsuitable
 * corpus returns a clean result over an empty set and the result looks like
 * proof. The builder therefore also links the Python roots the interpreter
 * itself reports, so the Python half of the core is compared against Python.
 */

const OUT = process.argv[2] ?? 'artifacts/ip-clean-room/dependency-corpus';
const STORE = process.argv[3] ?? 'node_modules/.pnpm';
/** Extra roots to link under py/, colon-separated. Use it for an install target
 *  produced by `pip install --target <dir> -r <requirements>`, which is how the
 *  declared dependencies of apps/tai enter the corpus on a machine where they
 *  are not installed system-wide. */
const PYTHON_EXTRA_ROOTS = String(process.env.IP_CORPUS_PYTHON_ROOTS ?? '').trim();
/** Set to 0 to screen against npm only; the record must then say so. */
const PYTHON_AUTODISCOVER = process.env.IP_CORPUS_PYTHON_AUTODISCOVER !== '0';

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

/**
 * The interpreter is asked where its own code lives rather than being told, so
 * the corpus follows whichever Python actually runs apps/tai instead of a list
 * of paths that is right on one machine.
 */
export function discoverPythonRoots(run = defaultPythonProbe) {
  let raw = '';
  try {
    raw = run();
  } catch {
    return [];
  }
  let parsed = [];
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  return parsed.filter((entry) => typeof entry === 'string' && entry.length > 0);
}

function defaultPythonProbe() {
  return execFileSync('python3', ['-c', [
    'import json, os, site, sys',
    'roots = list(sys.path)',
    'roots += site.getsitepackages() if hasattr(site, "getsitepackages") else []',
    'user = site.getusersitepackages() if hasattr(site, "getusersitepackages") else None',
    'roots += [user] if isinstance(user, str) else []',
    'print(json.dumps(sorted({r for r in roots if r and os.path.isdir(r)})))',
  ].join('\n')], { encoding: 'utf8' });
}

/**
 * A filesystem path flattened into one directory name. The screening tool
 * excludes any path carrying a node_modules, dist, build, test or fixture
 * segment; a Python root re-rooted as a nested path would lose files to that
 * filter for reasons that have nothing to do with the files. Flattening keeps
 * every segment visible in the name and none of them structural.
 */
export function pythonEntryName(root) {
  return root.replaceAll('/', '_').replaceAll('\\', '_').replace(/^_+/u, '_');
}

function linkPythonRoots(out) {
  const roots = [];
  if (PYTHON_AUTODISCOVER) roots.push(...discoverPythonRoots());
  for (const entry of PYTHON_EXTRA_ROOTS.split(':')) {
    const trimmed = entry.trim();
    if (trimmed) roots.push(resolve(trimmed));
  }
  const pythonOut = join(out, 'py');
  mkdirSync(pythonOut, { recursive: true });
  let linked = 0;
  for (const root of [...new Set(roots)]) {
    if (!existsSync(root) || !lstatSync(root).isDirectory()) continue;
    const destination = join(pythonOut, pythonEntryName(root));
    if (existsSync(destination)) continue;
    if (linkTree(root, destination)) linked += 1;
  }
  return { linked, requested: [...new Set(roots)].length };
}

function main() {
  const out = resolve(OUT);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const npmOut = join(out, 'npm');
  mkdirSync(npmOut, { recursive: true });
  const packages = packageDirectories(STORE);
  let linked = 0;
  for (const pkg of packages) {
    const destination = join(npmOut, corpusEntryName(pkg.id, pkg.name));
    if (existsSync(destination)) continue;
    if (!lstatSync(pkg.path).isDirectory()) continue;
    if (linkTree(pkg.path, destination)) linked += 1;
  }

  const python = linkPythonRoots(out);
  const dropped = dropNonRegular(out);
  let files = 0;
  const byExtension = new Map();
  const count = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) { count(join(directory, entry.name)); continue; }
      if (!entry.isFile()) continue;
      files += 1;
      const dot = entry.name.lastIndexOf('.');
      const extension = dot > 0 ? entry.name.slice(dot).toLowerCase() : '(none)';
      byExtension.set(extension, (byExtension.get(extension) ?? 0) + 1);
    }
  };
  count(out);

  console.log(`DEPENDENCY_CORPUS: ${linked} package(s) linked from ${STORE}, ${python.linked} of ${python.requested} Python root(s) linked, ${files} regular file(s), ${dropped} non-regular entr(ies) dropped`);
  console.log(`  ${out}`);
  console.log('  Hard links: the corpus shares inodes with the store and costs no additional space.');
  // Printed because the first published run was clean for 151 Python files that
  // had one Python file to be clean against. A corpus is only evidence for the
  // languages it actually contains, so the composition is part of the output.
  for (const extension of ['.js', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.sql', '.css', '.scss', '.prisma']) {
    console.log(`  ${extension.padEnd(8)} ${byExtension.get(extension) ?? 0}`);
  }
  if (linked === 0) {
    console.error('DEPENDENCY_CORPUS: FAIL - no package linked; is the dependency store installed?');
    return 1;
  }
  if (python.linked === 0) {
    console.error('DEPENDENCY_CORPUS: WARNING - no Python root linked; any Python file in the protected core would be screened against nothing.');
  }
  if (statSync(out).isDirectory() === false) return 1;
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
