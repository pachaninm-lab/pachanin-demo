#!/usr/bin/env node
/**
 * ASVS 5.0 V15.3.2: the backend must not follow redirects unless following one
 * is intended functionality.
 *
 * A redirect is the far end choosing a second destination after the first one
 * has already been vetted. Every check this application makes about where a
 * request may go - the scheme check, the address rules, the operator allowlist,
 * the configured base URL - is made against the URL the code built. `fetch`
 * defaults to `redirect: 'follow'`, so a 3xx moves the request somewhere none of
 * those checks ever saw, carrying whatever headers the platform does not strip.
 * `Authorization` is dropped across origins; a bespoke credential header such as
 * `X-Vault-Token` is not.
 *
 * The control is therefore not "no redirect is followed anywhere" but "no call
 * site leaves the decision to the default". Each backend call site states its
 * posture, and a site that genuinely needs to follow says so in the baseline
 * with a reason.
 *
 * Browser call sites are out of scope, and are recognised by reading the file
 * rather than by trusting a list: a module carrying the "use client" directive
 * runs in the browser, where the fetch spec's redirect handling and the origin
 * model are the controls, and where refusing a same-origin 3xx would break
 * ordinary navigation. The directive is read from the source on every run, so a
 * file cannot be excluded by asserting that it is a client module.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Roots whose code runs on a server. Anything outside is not backend code. */
export const BACKEND_ROOTS = [
  'apps/api/src/',
  'apps/web/app/',
  'apps/web/lib/',
  'apps/web/server/',
  'apps/web/components/',
];

/** A redirect posture that does not leave the default in place. */
export const DECIDED_VALUES = new Set(['error', 'manual']);

const TEST_FILE = /(^|\/)(tests?|__tests__)\//;
const TEST_NAME = /\.(test|spec)\.[cm]?[jt]sx?$/;

/* ------------------------------------------------------------------ *
 * Locating real code
 *
 * `fetch(` inside a comment or a string is not a call site, and a template
 * literal may contain braces and parentheses that are text rather than
 * structure. Everything below works on a mask marking which byte offsets are
 * code, so the brace matching cannot be thrown off by a URL in a string.
 * ------------------------------------------------------------------ */

/**
 * Classifies every offset: 0 executable code, COMMENT, or LITERAL text.
 *
 * Comments and string bodies are both "not code" for bracket matching, but they
 * are not interchangeable. A comment sitting between two object properties has
 * to disappear before the property names can be read, while a quoted property
 * name has to survive - blanking both would hide `'redirect': 'error'`.
 */
export const COMMENT = 1;
export const LITERAL = 2;

export function maskNonCode(source) {
  const mask = new Uint8Array(source.length);
  const frames = [];
  let templateText = false;
  let previous = '';
  let i = 0;

  const fill = (from, to, kind) => { for (let k = from; k < to; k += 1) mask[k] = kind; };

  while (i < source.length) {
    const c = source[i];

    if (templateText) {
      if (c === '\\') { fill(i, Math.min(i + 2, source.length), LITERAL); i += 2; continue; }
      if (c === '`') { mask[i] = LITERAL; i += 1; frames.pop(); templateText = frames.length > 0 && frames[frames.length - 1].kind === 'template'; previous = '`'; continue; }
      if (c === '$' && source[i + 1] === '{') { fill(i, i + 2, LITERAL); i += 2; frames.push({ kind: 'subst', depth: 0 }); templateText = false; previous = '{'; continue; }
      mask[i] = LITERAL; i += 1; continue;
    }

    if (c === '/' && source[i + 1] === '/') { const end = source.indexOf('\n', i); const stop = end === -1 ? source.length : end; fill(i, stop, COMMENT); i = stop; continue; }
    if (c === '/' && source[i + 1] === '*') { const end = source.indexOf('*/', i + 2); const stop = end === -1 ? source.length : end + 2; fill(i, stop, COMMENT); i = stop; continue; }

    if (c === "'" || c === '"') {
      const quote = c; mask[i] = LITERAL; i += 1;
      while (i < source.length) {
        if (source[i] === '\\') { fill(i, Math.min(i + 2, source.length), LITERAL); i += 2; continue; }
        if (source[i] === quote) { mask[i] = LITERAL; i += 1; break; }
        if (source[i] === '\n') break;
        mask[i] = LITERAL; i += 1;
      }
      previous = 'x'; continue;
    }

    if (c === '`') { mask[i] = LITERAL; i += 1; frames.push({ kind: 'template' }); templateText = true; continue; }

    // A slash is a regular expression only where a value may begin.
    if (c === '/' && !/[\w$)\]]/u.test(previous)) {
      mask[i] = LITERAL; i += 1;
      let inClass = false;
      while (i < source.length) {
        if (source[i] === '\\') { fill(i, Math.min(i + 2, source.length), LITERAL); i += 2; continue; }
        if (source[i] === '[') inClass = true;
        else if (source[i] === ']') inClass = false;
        else if (source[i] === '/' && !inClass) { mask[i] = LITERAL; i += 1; break; }
        else if (source[i] === '\n') break;
        mask[i] = LITERAL; i += 1;
      }
      while (i < source.length && /[dgimsuvy]/u.test(source[i])) { mask[i] = LITERAL; i += 1; }
      previous = 'x'; continue;
    }

    const top = frames[frames.length - 1];
    if (c === '{' && top && top.kind === 'subst') top.depth += 1;
    else if (c === '}' && top && top.kind === 'subst') {
      if (top.depth === 0) { mask[i] = LITERAL; i += 1; frames.pop(); templateText = frames.length > 0 && frames[frames.length - 1].kind === 'template'; previous = '}'; continue; }
      top.depth -= 1;
    }

    if (!/\s/u.test(c)) previous = c;
    i += 1;
  }
  return mask;
}

/** Index of the bracket matching the opener at `open`, or -1. */
export function matchBracket(source, mask, open) {
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const close = pairs[source[open]];
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (mask[i]) continue;
    const c = source[i];
    if (c === source[open]) depth += 1;
    else if (c === close) { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

/** Splits an argument or member list on the commas that separate its items. */
export function splitTopLevel(source, mask, from, to) {
  const parts = [];
  let depth = 0;
  let start = from;
  for (let i = from; i < to; i += 1) {
    if (mask[i]) continue;
    const c = source[i];
    if (c === '(' || c === '{' || c === '[') depth += 1;
    else if (c === ')' || c === '}' || c === ']') depth -= 1;
    else if (c === ',' && depth === 0) { parts.push([start, i]); start = i + 1; }
  }
  parts.push([start, to]);
  return parts;
}

/** The source with comment bytes replaced by spaces, offsets preserved. */
export function withoutComments(source, mask) {
  let out = '';
  for (let i = 0; i < source.length; i += 1) out += mask[i] === COMMENT ? ' ' : source[i];
  return out;
}

/** Top-level property names of an object literal spanning [open, close]. */
export function objectKeys(source, mask, open, close) {
  const keys = [];
  const readable = withoutComments(source, mask);
  for (const [from, to] of splitTopLevel(source, mask, open + 1, close)) {
    const text = readable.slice(from, to);
    const named = /^\s*(?:\.\.\.)?\s*(?:(['"])([A-Za-z_$][\w$]*)\1|([A-Za-z_$][\w$]*))\s*(:|,|$)/u.exec(text);
    if (named && named[4] === ':') keys.push({ name: named[2] ?? named[3], from, to });
    else if (/^\s*\.\.\./u.test(text)) keys.push({ name: '...', from, to });
    else if (named) keys.push({ name: named[2] ?? named[3], from, to });
  }
  return keys;
}

const FETCH_CALL = /(?<![\w$])(?:(globalThis|window|global|self)\s*\.\s*)?fetch\s*\(/gu;

/** Every fetch call site in one file, with the redirect posture it declares. */
export function fetchSitesIn(source, file) {
  const mask = maskNonCode(source);
  const sites = [];
  const seen = new Map();
  FETCH_CALL.lastIndex = 0;
  let match;
  while ((match = FETCH_CALL.exec(source)) !== null) {
    const at = match.index;
    if (mask[at]) continue;
    // A member call on anything other than the global object is some other
    // API's `fetch` (a cache, a repository) and not an outbound request.
    const dot = source.lastIndexOf('.', at);
    if (!match[1] && dot >= 0 && /^\s*$/u.test(source.slice(dot + 1, at))) continue;

    const open = at + match[0].length - 1;
    const close = matchBracket(source, mask, open);
    if (close === -1) continue;

    const args = splitTopLevel(source, mask, open + 1, close);
    const target = source.slice(args[0][0], args[0][1]).trim().replace(/\s+/gu, ' ');

    let posture = 'default';
    let value = null;
    if (args.length >= 2) {
      const [initFrom, initTo] = args[1];
      const initText = source.slice(initFrom, initTo).trim();
      if (initText.startsWith('{')) {
        const braceOpen = source.indexOf('{', initFrom);
        const braceClose = matchBracket(source, mask, braceOpen);
        const keys = objectKeys(source, mask, braceOpen, braceClose);
        const redirect = keys.find((k) => k.name === 'redirect');
        if (redirect) {
          posture = 'declared';
          const literal = /:\s*['"]([a-z]+)['"]/u.exec(source.slice(redirect.from, redirect.to));
          value = literal ? literal[1] : 'computed';
        } else if (keys.some((k) => k.name === '...')) {
          posture = 'spread';
        }
      } else if (initText !== '') {
        posture = 'indirect';
      }
    }

    const occurrence = (seen.get(`${target}`) ?? 0);
    seen.set(`${target}`, occurrence + 1);
    sites.push({
      file,
      line: source.slice(0, at).split('\n').length,
      target,
      occurrence,
      posture,
      value,
      key: `${file}::${target}::${occurrence}`,
    });
  }
  return sites;
}

/**
 * "use client" makes a module browser code; it is read, never asserted.
 *
 * The leading trivia is skipped a piece at a time rather than with one
 * quantified alternation. Written as a regex, the whitespace branch and the
 * comment branch both match whitespace, and a repeat over overlapping
 * alternatives backtracks exponentially on a file that opens with a long
 * comment header and never reaches a directive - which is most files here.
 */
export function isClientModule(source) {
  let i = 0;
  for (;;) {
    while (i < source.length && (source[i] === ' ' || source[i] === '\t' || source[i] === '\r' || source[i] === '\n')) i += 1;
    if (source.startsWith('//', i)) {
      const end = source.indexOf('\n', i);
      if (end === -1) return false;
      i = end + 1;
    } else if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) return false;
      i = end + 2;
    } else break;
  }
  return source.startsWith("'use client'", i) || source.startsWith('"use client"', i);
}

export function isBackendPath(file) {
  if (TEST_FILE.test(file) || TEST_NAME.test(file)) return false;
  return BACKEND_ROOTS.some((root) => file.startsWith(root));
}

/** Globals that exist only in a browser. */
const BROWSER_GLOBAL = /(?<![\w$.])(?:window|document|navigator|localStorage|sessionStorage)\s*[.[]/u;

/** A relative URL cannot be fetched from Node at all, so it proves the context. */
export function isRelativeUrlLiteral(target) {
  return /^['"`]\s*\//u.test(target) && !/^['"`]\s*\/\//u.test(target);
}

/**
 * Checks the claim an exception makes, rather than accepting it.
 *
 * A baseline whose entries are only assertions is a list of things somebody
 * once believed. "browser" is the claim that carries a checkable consequence,
 * so it is checked: either the call names a relative URL - which Node cannot
 * fetch at all, so the context is proven - or the module reaches for a global
 * that exists only in a browser. Neither makes a module client-side on its own,
 * which is why the written reason is still required; but a module refactored
 * into pure server code stops satisfying this and the entry stops covering it.
 *
 * "intended-redirect" has nothing comparable to check. It is a statement about
 * the far end, so it rests on its reason alone and is listed separately in the
 * output so it never blends into the checked ones.
 */
export function categoryProblem(entry, site, source) {
  if (entry.category === 'intended-redirect') return null;
  if (entry.category !== 'browser') return `unknown category ${JSON.stringify(entry.category ?? null)}`;
  if (isRelativeUrlLiteral(site.target)) return null;
  if (BROWSER_GLOBAL.test(source)) return null;
  return 'claims to be browser code but names no relative URL and no browser-only global';
}

/**
 * Compares the sites found against the recorded exceptions.
 *
 * Both directions matter. An unjudged site is a call whose posture nobody
 * decided; a stale entry is an exception for a call that no longer exists,
 * which would otherwise let a removed justification keep covering a future
 * call that happens to reappear at the same place.
 */
export function reconcile(sites, baseline, sourceOf = () => '') {
  const allowed = new Map((baseline.sites ?? []).map((entry) => [entry.key, entry]));
  const unjudged = [];
  const following = [];
  const badReason = [];
  const badCategory = [];
  const used = new Set();

  for (const site of sites) {
    const entry = allowed.get(site.key);
    if (entry) {
      used.add(site.key);
      if (typeof entry.reason !== 'string' || entry.reason.trim().length < 20) badReason.push(site);
      const problem = categoryProblem(entry, site, sourceOf(site.file));
      if (problem) badCategory.push({ key: site.key, problem });
      continue;
    }
    if (site.posture === 'declared' && site.value !== 'computed' && DECIDED_VALUES.has(site.value)) continue;
    if (site.posture === 'declared' && site.value === 'follow') { following.push(site); continue; }
    unjudged.push(site);
  }

  const stale = (baseline.sites ?? []).filter((entry) => !used.has(entry.key));
  return { unjudged, following, badReason, badCategory, stale };
}

function main() {
  const root = process.cwd();
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8').split('\0').filter(Boolean);

  const sites = [];
  const sources = new Map();
  let clientModules = 0;
  let clientSites = 0;
  let scanned = 0;

  for (const file of tracked) {
    if (!/\.[cm]?[jt]sx?$/u.test(file)) continue;
    if (!isBackendPath(file)) continue;
    let source;
    try { source = readFileSync(path.join(root, file), 'utf8'); } catch { continue; }
    if (!source.includes('fetch')) continue;
    const found = fetchSitesIn(source, file);
    if (found.length === 0) continue;
    if (isClientModule(source)) { clientModules += 1; clientSites += found.length; continue; }
    scanned += 1;
    sources.set(file, source);
    sites.push(...found);
  }

  const baselinePath = path.join(root, 'docs/security/outbound-redirect-baseline.json');
  let baseline = { sites: [] };
  try { baseline = JSON.parse(readFileSync(baselinePath, 'utf8')); } catch { /* absent is empty */ }

  const { unjudged, following, badReason, badCategory, stale } =
    reconcile(sites, baseline, (file) => sources.get(file) ?? '');

  if (process.argv.includes('--report')) {
    console.log(JSON.stringify({ sites }, null, 2));
    return;
  }

  const decided = sites.filter((s) => s.posture === 'declared' && DECIDED_VALUES.has(s.value)).length;
  console.log(`outbound redirect policy: ${sites.length} backend fetch sites in ${scanned} files`);
  const byCategory = new Map();
  for (const entry of baseline.sites ?? []) byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + 1);
  const exceptions = [...byCategory].map(([name, n]) => `${n} ${name}`).join(', ') || 'none';
  console.log(`  ${decided} refuse or hand back redirects, judged exceptions: ${exceptions}`);
  console.log(`  ${clientSites} browser sites in ${clientModules} "use client" modules are out of scope`);

  let failed = false;
  const report = (label, rows, render) => {
    if (rows.length === 0) return;
    failed = true;
    console.error(`\n${label} (${rows.length}):`);
    for (const row of rows) console.error(`  ${render(row)}`);
  };

  report('backend fetch sites that leave the redirect default in place', unjudged,
    (s) => `${s.file}:${s.line}  fetch(${s.target.slice(0, 60)})  [${s.posture}]`);
  report("backend fetch sites that follow redirects without a recorded reason", following,
    (s) => `${s.file}:${s.line}  fetch(${s.target.slice(0, 60)})`);
  report('baseline entries whose reason is missing or too short to be one', badReason,
    (s) => s.key);
  report('baseline entries whose category no longer holds', badCategory,
    (e) => `${e.key}  ${e.problem}`);
  report('baseline entries for call sites that no longer exist', stale,
    (e) => e.key);

  if (failed) {
    console.error('\nEvery backend fetch must state its redirect posture. Add redirect: \'error\' at the');
    console.error("call site, or record the site in docs/security/outbound-redirect-baseline.json with");
    console.error('a reason saying why following a redirect is intended functionality there.');
    process.exit(1);
  }
  console.log('\nno backend fetch leaves redirect handling to the default');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
