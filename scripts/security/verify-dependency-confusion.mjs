#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ASVS 5.0 V15.2.4: every dependency comes from the repository it is meant to.
 *
 * Dependency confusion is not about what we publish - that is the other
 * direction, and scripts/ip/verify-private-packages.mjs already holds it. It is
 * about what an attacker publishes: a package on the public registry carrying one
 * of our internal names, which the installer then prefers over the local one.
 *
 * This repository is exposed to that in a specific and unusual way. Two packages
 * carrying internal names - @pc/design-system-v8 and @pc/design-tokens - are
 * deliberately EXCLUDED from the pnpm workspace by pnpm-workspace.yaml, and 62
 * source files import @pc/design-system-v8 anyway. A name that is imported but is
 * not a workspace member is exactly the shape the attack needs: remove whatever is
 * resolving it locally and the resolver falls through to the public registry.
 *
 * What holds today is measurable rather than asserted, and each part is a separate
 * rule so that losing one is a separate failure:
 *
 *   1. No manifest declares an internal name except by workspace: or link:. A
 *      version range for an internal name is a registry lookup waiting to happen.
 *   2. The lockfile resolves no internal name. Nothing has ever been fetched under
 *      one, so no integrity hash exists that could be satisfied by an impostor.
 *   3. Every internal specifier imported from source resolves locally - it is a
 *      workspace member or it has an explicit tsconfig path mapping. An import
 *      with neither is a registry lookup on the next clean install.
 *   4. No registry override points an internal scope somewhere unpinned.
 *
 * What this cannot check, and says so rather than implying otherwise: whether the
 * @pc and @pachanin scopes are actually registered to us on the public registry.
 * That is a fact about npmjs.com, not about this repository, and this gate does
 * not reach the network.
 */

const INSTALL_PROTOCOLS = /^(workspace:|link:|file:)/u;
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
}

export function manifestPaths(tracked) {
  return tracked.filter((path) => path === 'package.json'
    || /^(apps|packages)\/[^/]+\/package\.json$/u.test(path));
}

/** The names this repository owns, taken from its own manifests rather than from a
 *  list somebody has to remember to update. */
export function internalNames(manifests) {
  const names = new Set();
  for (const manifest of manifests) if (manifest.name) names.add(manifest.name);
  return names;
}

/** A scope is ours if any package we own lives in it. `@pc/anything` is then a
 *  name an attacker could try to claim, whether or not we have a package by that
 *  exact name today. */
export function internalScopes(names) {
  const scopes = new Set();
  for (const name of names) {
    const match = /^(@[^/]+)\//u.exec(name);
    if (match) scopes.add(match[1]);
  }
  return scopes;
}

export function isInternalSpecifier(specifier, names, scopes) {
  if (names.has(specifier)) return true;
  for (const scope of scopes) if (specifier === scope || specifier.startsWith(`${scope}/`)) return true;
  return false;
}

/** The package name a module specifier resolves to: `@pc/a/b` -> `@pc/a`. */
export function packageNameOf(specifier) {
  if (!specifier.startsWith('@')) return specifier.split('/')[0];
  const parts = specifier.split('/');
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
}

export function declaredInternalDependencies(manifests, names, scopes) {
  const offences = [];
  for (const { path, manifest } of manifests) {
    for (const field of DEPENDENCY_FIELDS) {
      for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
        if (!isInternalSpecifier(name, names, scopes)) continue;
        if (INSTALL_PROTOCOLS.test(String(spec))) continue;
        offences.push(`${path}: ${field}.${name} is "${spec}"; an internal name must use workspace:, link: or file:, never a version range`);
      }
    }
  }
  return offences;
}

/** pnpm writes resolved packages under `packages:` and `snapshots:` keyed by
 *  `name@version`. An internal name appearing there means something was fetched
 *  under it. */
export function lockfileInternalResolutions(lockfile, names, scopes) {
  const offences = [];
  for (const line of lockfile.split('\n')) {
    const match = /^ {2}'?((?:@[^/'@]+\/)?[^@'\s][^@']*)@/u.exec(line);
    if (!match) continue;
    const name = match[1];
    if (isInternalSpecifier(name, names, scopes)) offences.push(`pnpm-lock.yaml resolves internal name ${name}`);
  }
  return offences;
}

export function importedInternalSpecifiers(files, read) {
  const pattern = /(?:from|import|require\()\s*['"]([^'"]+)['"]/gu;
  const found = new Map();
  for (const file of files) {
    let source = '';
    try { source = read(file); } catch { continue; }
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (!specifier.startsWith('@') && !/^[a-z]/u.test(specifier)) continue;
      const bucket = found.get(specifier) ?? [];
      bucket.push(file);
      found.set(specifier, bucket);
    }
  }
  return found;
}

export function unresolvableInternalImports(imported, names, scopes, aliases) {
  const offences = [];
  for (const [specifier, files] of imported) {
    if (!isInternalSpecifier(specifier, names, scopes)) continue;
    const name = packageNameOf(specifier);
    if (names.has(name)) continue;
    if (aliases.has(specifier) || aliases.has(name) || aliases.has(`${name}/*`)) continue;
    offences.push(`${specifier} is imported by ${files.length} file(s) (e.g. ${files[0]}) but is neither a workspace package nor an explicit path alias; a clean install resolves it from the public registry`);
  }
  return offences;
}

export function registryOverrides(npmrc, scopes) {
  const offences = [];
  for (const line of npmrc.split('\n')) {
    const match = /^\s*(@[^:\s]+):registry\s*=\s*(\S+)/u.exec(line);
    if (!match) continue;
    if (!scopes.has(match[1])) continue;
    if (!/^https:\/\//u.test(match[2])) {
      offences.push(`.npmrc points ${match[1]} at ${match[2]}, which is not an https registry`);
    }
  }
  return offences;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/u, ''));
}

/** tsconfig paths, with comments stripped, from every tracked tsconfig. */
function aliasKeys(tracked) {
  const keys = new Set();
  for (const path of tracked.filter((entry) => /(^|\/)tsconfig[^/]*\.json$/u.test(entry))) {
    let document = null;
    try {
      document = JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/u, '').replace(/(^|\s)\/\/.*$/gmu, '$1'));
    } catch { continue; }
    for (const key of Object.keys(document?.compilerOptions?.paths ?? {})) keys.add(key);
  }
  return keys;
}

function main() {
  const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);
  const manifests = manifestPaths(tracked)
    .filter((path) => existsSync(path))
    .map((path) => ({ path, manifest: readJson(path) }));
  const names = internalNames(manifests.map((entry) => entry.manifest));
  const scopes = internalScopes(names);

  const failures = [
    ...declaredInternalDependencies(manifests, names, scopes),
    ...lockfileInternalResolutions(existsSync('pnpm-lock.yaml') ? readFileSync('pnpm-lock.yaml', 'utf8') : '', names, scopes),
    ...unresolvableInternalImports(
      importedInternalSpecifiers(
        tracked.filter((path) => /\.(ts|tsx|js|jsx|mjs|cjs)$/u.test(path) && !path.includes('node_modules')),
        (path) => readFileSync(path, 'utf8'),
      ),
      names,
      scopes,
      aliasKeys(tracked),
    ),
    ...registryOverrides(existsSync('.npmrc') ? readFileSync('.npmrc', 'utf8') : '', scopes),
  ];

  if (failures.length) {
    console.error('dependency confusion guard FAILED');
    for (const failure of failures) console.error(`- ${failure}`);
    return 1;
  }
  console.log(`dependency confusion guard PASS: ${names.size} internal name(s) across ${scopes.size} owned scope(s); none declared by version range, none resolved in the lockfile, every imported internal specifier resolves locally`);
  console.log('  Not checked here, and not implied: whether those scopes are registered to us on the public registry. That is a fact about npmjs.com and this gate does not reach the network.');
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
