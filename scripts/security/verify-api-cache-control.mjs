#!/usr/bin/env node
/**
 * Gate: every API route handler must tell the browser not to store the response.
 *
 * ASVS 5.0 V14.3.2. A handler that returns a deal, a document or a session and
 * says nothing about caching leaves that response in the browser's cache, on a
 * shared machine, after logout.
 *
 * Coverage is decided by following the return path, not by looking at the route
 * file alone. Measuring this file-locally was wrong twice while this gate was
 * being written, in both directions:
 *
 *   - gekta/auth/login sets no header of its own and is covered, because every
 *     return goes through gektaAuthJson, which sets it;
 *   - the first version of the scan resolved only relative imports, so every
 *     route reaching a helper through the `@/` alias was counted as uncovered.
 *
 * Streaming handlers are exempt and are counted separately rather than
 * silently: text/event-stream responses set `no-cache, no-transform` on
 * purpose, and no-transform is what stops an intermediary from breaking the
 * stream. Forcing no-store on them would take that away.
 *
 * What this gate does NOT check: that the header reaches the client at runtime.
 * It reads source. A proxy that strips the header, or a framework rule that
 * overrides it, is out of its reach - and that limit is printed with the
 * result, because a check that quietly skips what it cannot do reads, from the
 * outside, exactly like one that verified it.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const ROUTE_GLOB = 'apps/web/app/api/**/route.ts';
const WEB_ROOT = 'apps/web';
const MAX_IMPORT_DEPTH = 3;

const read = (file) => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
};

/** Resolve a relative or `@/`-aliased import to a file on disk. */
export function resolveImport(from, specifier, exists = existsSync) {
  let base;
  if (specifier.startsWith('@/')) base = resolve(WEB_ROOT, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
  else return null;
  // Пути возвращаются в том же виде, в каком приходят из git ls-files —
  // относительными к корню. Иначе один и тот же файл выглядел бы как два
  // разных в множестве посещённых, и цикл импортов перестал бы обрываться.
  const asRepoPath = (candidate) => {
    const rel = relative(process.cwd(), candidate);
    return rel.startsWith('..') ? candidate : rel;
  };
  for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const candidate = asRepoPath(`${base}${suffix}`);
    if (exists(candidate)) return candidate;
  }
  return null;
}

/**
 * Does this module, or anything it imports within a few hops, set the header?
 *
 * The pattern accepts both spellings the codebase uses: a header object literal
 * (`'Cache-Control': 'no-store'`) and a Headers call (`set('cache-control', …)`).
 * Accepting only the first was the third measurement error while writing this:
 * the shared helper uses the second, so a tree that had just been fixed still
 * reported every route as uncovered.
 */
export function setsCacheControl(file, { readFile = read, exists = existsSync } = {}, depth = 0, seen = new Set()) {
  if (depth > MAX_IMPORT_DEPTH || seen.has(file)) return false;
  seen.add(file);
  const text = readFile(file);
  if (/['"]cache-control['"]\s*[:,]/iu.test(text)) return true;
  for (const match of text.matchAll(/from\s+['"]([^'"]+)['"]/gu)) {
    const next = resolveImport(file, match[1], exists);
    if (next && setsCacheControl(next, { readFile, exists }, depth + 1, seen)) return true;
  }
  return false;
}

export function classify(files, io = {}) {
  const readFile = io.readFile ?? read;
  const covered = [];
  const streaming = [];
  const uncovered = [];
  for (const file of files) {
    if (/text\/event-stream/u.test(readFile(file))) streaming.push(file);
    else if (setsCacheControl(file, io)) covered.push(file);
    else uncovered.push(file);
  }
  return { covered, streaming, uncovered };
}

function main() {
  const files = execFileSync('git', ['ls-files', ROUTE_GLOB], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const { covered, streaming, uncovered } = classify(files);

  console.log(
    `API_CACHE_CONTROL: handlers=${files.length} covered=${covered.length}`
    + ` streaming_exempt=${streaming.length} uncovered=${uncovered.length}`,
  );
  console.log(
    '  Source-level check: coverage is followed through helper imports, but whether the'
    + ' header survives a proxy or a framework rule at runtime is outside its reach.',
  );

  for (const file of uncovered) {
    console.error(`NO_CACHE_CONTROL ${file}`);
  }
  if (uncovered.length) {
    console.error(
      `\nAPI_CACHE_CONTROL: FAIL - ${uncovered.length} handler(s) say nothing about caching.`
      + "\nReturn through jsonNoStore (apps/web/lib/http/no-store.ts), or set the header on the response.",
    );
    process.exitCode = 1;
    return;
  }
  console.log('API_CACHE_CONTROL: PASS - every handler either sets the header or is an exempt stream.');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
