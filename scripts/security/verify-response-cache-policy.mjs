#!/usr/bin/env node
/**
 * ASVS 5.0 V14.3.2: responses carrying sensitive data must not be stored by the
 * browser.
 *
 * Every /api route in the web application is authenticated or dynamic, so the
 * policy is applied centrally: applyApiCachePolicy in middleware.ts sets
 * Cache-Control: no-store at the one place every branch of the middleware
 * returns through, which means a route added tomorrow is covered without anyone
 * remembering to cover it.
 *
 * That central header REPLACES whatever the route set. Measured against a real
 * Next server: a header set in middleware overrides the route handler's, and so
 * does one declared in next.config.js headers(). Replacing `no-store` with
 * `no-store` is harmless; replacing `no-store, no-transform` with `no-store` is
 * not, because `no-transform` is what stops a proxy buffering or re-encoding an
 * event stream. Those routes are exempted and manage their own header.
 *
 * An exemption is where a central policy goes wrong, so this checks both ends:
 *
 * 1. The exempt list is exactly the routes that need it - a route whose header
 *    says no more than no-store has nothing to lose and may not opt out.
 * 2. Every response an exempt route constructs sets Cache-Control with
 *    no-store, error paths included, so opting out is not a way to emit none.
 *
 * `cache: 'no-store'` on an outbound fetch is NOT coverage and is never counted
 * as such. It configures the Next data cache on a request this server makes; it
 * says nothing about what the browser may store. 33 route files carry it, which
 * is exactly the kind of thing that reads as coverage and is none.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const MIDDLEWARE = 'apps/web/middleware.ts';
export const API_ROOT = 'apps/web/app/api/';

/** Constructors whose result becomes an HTTP response. */
const RESPONSE_CALL = /(?<![\w$])(?:new\s+(?:Next)?Response|(?:Next)?Response\s*\.\s*json)\s*\(/gu;
/** A Cache-Control RESPONSE header, not the fetch RequestInit `cache:` option. */
const CACHE_HEADER = /['"]?cache-control['"]?\s*:\s*['"`]([^'"`]*)['"`]/giu;

/**
 * Marks comments and string/template text so brackets in them are ignored.
 *
 * The two are distinguished, not merged. A header name is written INSIDE a
 * string - 'Cache-Control' - so treating string bodies as "not code" and
 * skipping them finds no headers at all anywhere in the repository, which reads
 * as a total absence of coverage rather than as the bug it is. Comments must
 * still be skipped, or a header named in a comment counts as one that is set.
 */
export const COMMENT = 1;
export const LITERAL = 2;

export function maskNonCode(source) {
  const mask = new Uint8Array(source.length);
  const frames = [];
  let templateText = false;
  let i = 0;
  const fill = (from, to, kind = LITERAL) => { for (let k = from; k < to; k += 1) mask[k] = kind; };

  while (i < source.length) {
    const c = source[i];
    if (templateText) {
      if (c === '\\') { fill(i, Math.min(i + 2, source.length)); i += 2; continue; }
      if (c === '`') { mask[i] = LITERAL; i += 1; frames.pop(); templateText = frames.at(-1)?.kind === 'template'; continue; }
      if (c === '$' && source[i + 1] === '{') { fill(i, i + 2); i += 2; frames.push({ kind: 'subst', depth: 0 }); templateText = false; continue; }
      mask[i] = LITERAL; i += 1; continue;
    }
    if (c === '/' && source[i + 1] === '/') { const e = source.indexOf('\n', i); const stop = e === -1 ? source.length : e; fill(i, stop, COMMENT); i = stop; continue; }
    if (c === '/' && source[i + 1] === '*') { const e = source.indexOf('*/', i + 2); const stop = e === -1 ? source.length : e + 2; fill(i, stop, COMMENT); i = stop; continue; }
    if (c === "'" || c === '"') {
      const q = c; mask[i] = LITERAL; i += 1;
      while (i < source.length) {
        if (source[i] === '\\') { fill(i, Math.min(i + 2, source.length)); i += 2; continue; }
        if (source[i] === q) { mask[i] = LITERAL; i += 1; break; }
        if (source[i] === '\n') break;
        mask[i] = LITERAL; i += 1;
      }
      continue;
    }
    if (c === '`') { mask[i] = LITERAL; i += 1; frames.push({ kind: 'template' }); templateText = true; continue; }
    const top = frames.at(-1);
    if (c === '{' && top?.kind === 'subst') top.depth += 1;
    else if (c === '}' && top?.kind === 'subst') {
      if (top.depth === 0) { mask[i] = LITERAL; i += 1; frames.pop(); templateText = frames.at(-1)?.kind === 'template'; continue; }
      top.depth -= 1;
    }
    i += 1;
  }
  return mask;
}

/** Index of the parenthesis matching the one at `open`, or -1. */
export function matchParen(source, mask, open) {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (mask[i] !== 0) continue;
    if (source[i] === '(') depth += 1;
    else if (source[i] === ')') { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

/** Every response construction in a file, and the Cache-Control it declares. */
export function responseSites(source) {
  const mask = maskNonCode(source);
  const sites = [];
  RESPONSE_CALL.lastIndex = 0;
  let match;
  while ((match = RESPONSE_CALL.exec(source)) !== null) {
    if (mask[match.index]) continue;
    const open = match.index + match[0].length - 1;
    const close = matchParen(source, mask, open);
    if (close === -1) continue;
    const args = source.slice(open + 1, close);
    CACHE_HEADER.lastIndex = 0;
    const values = [...args.matchAll(CACHE_HEADER)].map((m) => m[1].toLowerCase());
    sites.push({
      line: source.slice(0, match.index).split('\n').length,
      call: match[0].replace(/\s*\($/u, ''),
      values,
      noStore: values.some((v) => v.includes('no-store')),
    });
  }
  return sites;
}

/** Cache-Control values a file declares anywhere. */
export function declaredValues(source) {
  const mask = maskNonCode(source);
  CACHE_HEADER.lastIndex = 0;
  return [...source.matchAll(CACHE_HEADER)]
    .filter((m) => mask[m.index] !== COMMENT)
    .map((m) => m[1].toLowerCase());
}

/** The exempt list as middleware.ts actually declares it. */
export function exemptPathsFrom(source) {
  const exact = /const SELF_MANAGED_CACHE_CONTROL = new Set\(\[([\s\S]*?)\]\)/u.exec(source);
  const subtree = /const SELF_MANAGED_CACHE_CONTROL_SUBTREE = \[([\s\S]*?)\]/u.exec(source);
  const read = (block) => (block ? [...block[1].matchAll(/'([^']+)'/gu)].map((m) => m[1]) : []);
  return { exact: read(exact), subtree: read(subtree) };
}

/** The URL a route file answers on. */
export function routeUrl(file) {
  const rest = file.slice(API_ROOT.length).replace(/\/route\.tsx?$/u, '');
  return `/api/${rest}`.replace(/\/$/u, '');
}

/** A catch-all segment means every path beneath it is the same handler. */
export const isCatchAll = (file) => /\[\.\.\./u.test(file);

/**
 * A route needs its own header only when it declares a directive the blanket
 * no-store would drop. no-store alone, or with directives no-store already
 * implies, loses nothing by being replaced.
 */
const IMPLIED_BY_NO_STORE = new Set(['no-store', 'no-cache', 'must-revalidate', 'proxy-revalidate', 'private', 'max-age=0']);
export function needsOwnHeader(values) {
  return values.some((value) =>
    value.split(',').map((d) => d.trim()).filter(Boolean).some((d) => !IMPLIED_BY_NO_STORE.has(d)));
}

function main() {
  const root = process.cwd();
  const tracked = execFileSync('git', ['ls-files', '-z', API_ROOT, MIDDLEWARE], { cwd: root, maxBuffer: 32 * 1024 * 1024 })
    .toString('utf8').split('\0').filter(Boolean);
  const routes = tracked.filter((f) => /\/route\.tsx?$/u.test(f));
  const middleware = readFileSync(path.join(root, MIDDLEWARE), 'utf8');

  const problems = [];
  const push = (label, detail) => problems.push(`${label}\n    ${detail}`);

  // The central policy must still be wired to the one exported entry point.
  for (const needle of [
    'function applyApiCachePolicy(',
    "response.headers.set('cache-control', 'no-store');",
    'return applyApiCachePolicy(await routeRequest(req), req.nextUrl.pathname);',
  ]) {
    if (!middleware.includes(needle)) push('the central policy is no longer wired', `missing from ${MIDDLEWARE}: ${needle}`);
  }

  const { exact, subtree } = exemptPathsFrom(middleware);
  const exempt = new Set(exact);
  const isExempt = (url) => exempt.has(url) || subtree.some((e) => url === e || url.startsWith(`${e}/`));

  let covered = 0;
  let selfManaged = 0;
  const unusedExact = new Set(exact);

  for (const file of routes) {
    const source = readFileSync(path.join(root, file), 'utf8');
    const url = routeUrl(file);
    const values = declaredValues(source);
    const wants = needsOwnHeader(values);

    if (isExempt(url)) {
      selfManaged += 1;
      unusedExact.delete(url);
      if (!wants) {
        push('exempt from the central policy but has nothing to lose by it',
          `${file} declares ${JSON.stringify(values)}; remove it from SELF_MANAGED_CACHE_CONTROL`);
      }
      // An exemption may not become a response with no header at all.
      for (const site of responseSites(source)) {
        if (!site.noStore) {
          push('an exempt route constructs a response with no no-store',
            `${file}:${site.line}  ${site.call}(...) declares ${JSON.stringify(site.values)}`);
        }
      }
      continue;
    }

    covered += 1;
    if (wants && !isCatchAll(file)) {
      push('sets a directive the central no-store would drop, but is not exempt',
        `${file} declares ${JSON.stringify(values)}; add ${url} to SELF_MANAGED_CACHE_CONTROL`);
    }
  }

  for (const url of unusedExact) {
    push('exempt path matches no route', `${url} is listed in SELF_MANAGED_CACHE_CONTROL but no route answers it`);
  }

  console.log(`response cache policy: ${routes.length} web API routes`);
  console.log(`  ${covered} take Cache-Control: no-store from the central policy`);
  console.log(`  ${selfManaged} set their own on every response they construct`);

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log('\nevery web API response carries no-store');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
