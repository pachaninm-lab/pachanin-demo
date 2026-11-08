#!/usr/bin/env node
/**
 * Gate: no unregistered accumulation into a computed key of a plain object.
 *
 * `acc[key] = (acc[key] ?? 0) + n` and `(acc[key] ||= []).push(x)` are correct
 * only while `key` can never be an inherited property name. When it can:
 *
 *   - `__proto__` — the read returns the prototype, so `?? 0` never fires and
 *     assigning a number is a silent no-op. The record disappears and the
 *     breakdown still looks well-formed.
 *   - `constructor` — the read returns the `Object` function, so `+ 1`
 *     concatenates and the cell renders as
 *     `function Object() { [native code] }1`.
 *
 * This class has already produced two measured defects in this repository:
 * the Rosstat Form 29-SKh culture tally lost 8000 t of 10400 t (77 percent),
 * and the IP due-diligence contributor breakdown undercounted its own
 * evidence.
 *
 * Every site must therefore either accumulate in a `Map` (see
 * `scripts/ip/tally.mjs`) or be registered in the allowlist with a recorded
 * measurement of why its key domain is closed. An unregistered site fails, and
 * so does a registration that no longer matches any site: a stale exemption is
 * an untrue statement about the code.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ALLOWLIST = process.argv.includes('--allowlist')
  ? process.argv[process.argv.indexOf('--allowlist') + 1]
  : 'docs/security/prototype-key-write-allowlist.json';
const REPORT = process.argv.includes('--report');

const SCANNED_EXTENSIONS = ['*.ts', '*.tsx', '*.mjs', '*.js', '*.cjs'];

/**
 * Test and spec files carry the defect as a deliberate fixture - the tests
 * below this gate assert that a plain-object accumulator loses records, and
 * that assertion needs the broken line in the source. A test fixture also
 * serves no request and produces no evidence, so a pattern there is not a
 * finding. Excluding them keeps the gate from flagging its own examples.
 */
const FIXTURE = /\.(?:test|spec)\.(?:ts|tsx|mjs|js|cjs)$/u;

// `X[k] = (X[k] ?? 0) + ...` / `... || 0) + ...` numeric accumulation.
const ACCUMULATOR = /([A-Za-z_$][\w$]*(?:\.[\w$]+)*)\s*\[\s*([^\]]{1,80}?)\s*\]\s*=\s*\(\s*\1\s*\[\s*[^\]]{1,80}?\s*\]\s*(?:\?\?|\|\|)\s*[^)]{1,40}\)\s*\+/u;
// `(X[k] ||= []).push(...)` / `X[k] ??= {}` lazy container init.
const LAZY_INIT = /([A-Za-z_$][\w$]*(?:\.[\w$]+)*)\s*\[\s*([^\]]{1,80}?)\s*\]\s*(?:\?\?=|\|\|=)\s*(?:\[\]|\{\}|new\s)/u;

/** A quoted or numeric literal key cannot be supplied by data. */
function literalKey(key) {
  return /^(['"`])[^'"`]*\1$/u.test(key) || /^-?\d+$/u.test(key);
}

export function findPrototypeKeyWrites(files, read = (file) => readFileSync(file, 'utf8')) {
  const hits = [];
  for (const file of files) {
    if (FIXTURE.test(file)) continue;
    let text;
    try {
      text = read(file);
    } catch {
      continue;
    }
    text.split('\n').forEach((line, index) => {
      if (/^\s*(?:\/\/|\/\*|\*)/u.test(line)) return;
      const match = ACCUMULATOR.exec(line) ?? LAZY_INIT.exec(line);
      if (!match) return;
      const [, target, key] = match;
      if (literalKey(key)) return;
      hits.push({ file, line: index + 1, target, key, source: line.trim().slice(0, 160) });
    });
  }
  return hits;
}

export function reconcile(hits, allowlist) {
  const registered = new Map(allowlist.map((entry) => [`${entry.file} ${entry.key}`, entry]));
  const seen = new Set();
  const unregistered = [];
  for (const hit of hits) {
    const id = `${hit.file} ${hit.key}`;
    if (registered.has(id)) {
      seen.add(id);
      continue;
    }
    unregistered.push(hit);
  }
  const stale = allowlist.filter((entry) => !seen.has(`${entry.file} ${entry.key}`));
  return { unregistered, stale };
}

function main() {
  const files = execFileSync('git', ['ls-files', ...SCANNED_EXTENSIONS], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const hits = findPrototypeKeyWrites(files);

  if (REPORT) {
    console.log(JSON.stringify(hits, null, 2));
    return;
  }

  const allowlist = JSON.parse(readFileSync(ALLOWLIST, 'utf8')).sites;
  const { unregistered, stale } = reconcile(hits, allowlist);

  console.log(`PROTOTYPE_KEY_WRITES: scanned=${files.length} sites=${hits.length} registered=${allowlist.length}`);

  for (const hit of unregistered) {
    console.error(`UNREGISTERED ${hit.file}:${hit.line}  target=${hit.target} key=${hit.key}`);
    console.error(`             ${hit.source}`);
  }
  for (const entry of stale) {
    console.error(`STALE_REGISTRATION ${entry.file}  key=${entry.key} - the code it describes is gone`);
  }

  if (unregistered.length || stale.length) {
    console.error(
      `\nPROTOTYPE_KEY_WRITES: FAIL - ${unregistered.length} unregistered, ${stale.length} stale.`
      + '\nAccumulate in a Map (scripts/ip/tally.mjs), or register the site with a measurement'
      + ` in ${ALLOWLIST}.`,
    );
    process.exitCode = 1;
    return;
  }
  console.log('PROTOTYPE_KEY_WRITES: PASS - every site is a Map or carries a measured exemption.');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
