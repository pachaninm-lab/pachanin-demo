#!/usr/bin/env node
/**
 * ASVS 5.0 V16.3.3: the application logs the security events DEFINED IN THE
 * DOCUMENTATION, and logs attempts to bypass its security controls.
 *
 * The requirement binds a document to behaviour, so a document alone cannot
 * satisfy it and neither can code alone. This checks the join, in all three
 * directions that can come apart:
 *
 * 1. Every event the catalogue declares is documented. Add an event to the code
 *    and forget the catalogue and the build fails.
 * 2. Every event the document describes exists in the catalogue. Delete an event
 *    from the code and the document is left describing a control that is gone -
 *    which is worse than never having described it, because a reader believes it.
 * 3. Every event has at least one call site that actually emits it, in shipped
 *    code rather than in a test. An event declared, documented, and emitted
 *    nowhere is exactly the "policy as implementation" this register refuses.
 *
 * It also requires each documented control to name a class that exists, because
 * a catalogue entry pointing at a control nobody can find is not evidence.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const CATALOGUE = 'apps/api/src/common/security/security-events.ts';
export const DOCUMENT = 'docs/security/SECURITY_EVENT_CATALOGUE.md';
const EMITTER_ROOT = 'apps/api/src/';

/** The event names the code declares, read from the frozen object. */
export function declaredEvents(source) {
  const block = /export const SECURITY_EVENTS = Object\.freeze\(\{([\s\S]*?)\}\);/u.exec(source);
  if (!block) return null;
  return [...block[1].matchAll(/^\s*([A-Z0-9_]+):\s*'([^']+)'/gmu)]
    .map(([, key, value]) => ({ key, value }));
}

/** The event names the document describes, read from its own headings. */
export function documentedEvents(markdown) {
  return [...markdown.matchAll(/^###\s+`([a-z0-9_.]+)`\s*$/gmu)].map((m) => m[1]);
}

/** The control each documented event names. */
export function documentedControls(markdown) {
  const controls = new Map();
  const sections = markdown.split(/^###\s+`/mu).slice(1);
  for (const section of sections) {
    const name = /^([a-z0-9_.]+)`/u.exec(section)?.[1];
    const control = /^-\s+\*\*Control\*\*:\s*`?([A-Za-z]+)`?/mu.exec(section)?.[1];
    if (name) controls.set(name, control ?? null);
  }
  return controls;
}

/**
 * Call sites that emit an event, by catalogue key.
 *
 * Matched by scanning rather than by building a regular expression from the
 * key. A `new RegExp` assembled from a value has to be shown safe before it can
 * stay (docs/security/regex-construction-baseline.json), and the argument for
 * this one would have been that the key comes from the catalogue rather than
 * from input - true, but the scan is simpler than the argument and needs no
 * exception. The statement is bounded at the first `;` so a mention of the
 * event in some later statement is not read as a call that passes it.
 */
export function emittersFor(sources, keys) {
  const found = new Map(keys.map((key) => [key, []]));
  for (const [file, text] of sources) {
    const statements = text.split('recordSecurityEvent').slice(1).map((rest) => {
      const end = rest.indexOf(';');
      return end === -1 ? rest : rest.slice(0, end);
    });
    for (const key of keys) {
      const needle = `SECURITY_EVENTS.${key}`;
      const passes = statements.some((statement) => {
        const at = statement.indexOf(needle);
        // A key that is a prefix of another key must not match it.
        return at !== -1 && !/[\w$]/u.test(statement.charAt(at + needle.length));
      });
      if (passes) found.get(key).push(file);
    }
  }
  return found;
}

const isTest = (file) => /\.(spec|test)\.[cm]?[jt]sx?$/u.test(file) || /(^|\/)(tests?|__tests__)\//u.test(file);

function main() {
  const root = process.cwd();
  const read = (file) => readFileSync(path.join(root, file), 'utf8');

  const catalogueSource = read(CATALOGUE);
  const markdown = read(DOCUMENT);

  const declared = declaredEvents(catalogueSource);
  if (declared === null) {
    console.error(`${CATALOGUE}: SECURITY_EVENTS is not a frozen object literal any more; nothing can be checked against it`);
    process.exit(1);
  }

  const documented = documentedEvents(markdown);
  const controls = documentedControls(markdown);

  const tracked = execFileSync('git', ['ls-files', '-z', EMITTER_ROOT], { cwd: root, maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8').split('\0').filter(Boolean)
    .filter((f) => /\.[cm]?ts$/u.test(f) && !isTest(f));
  const sources = tracked.map((file) => [file, read(file)]);
  const emitters = emittersFor(sources, declared.map((d) => d.key));

  const problems = [];
  const declaredNames = new Set(declared.map((d) => d.value));
  const documentedNames = new Set(documented);

  for (const { key, value } of declared) {
    if (!documentedNames.has(value)) {
      problems.push(`declared but not documented: ${value} (SECURITY_EVENTS.${key}) — add a section to ${DOCUMENT}`);
    }
    const sites = emitters.get(key) ?? [];
    if (sites.length === 0) {
      problems.push(`documented and declared but emitted nowhere: ${value} — no recordSecurityEvent call under ${EMITTER_ROOT}`);
    }
  }
  for (const name of documented) {
    if (!declaredNames.has(name)) {
      problems.push(`documented but not declared: ${name} — ${DOCUMENT} describes a control the code does not have`);
    }
    const control = controls.get(name);
    if (!control) {
      problems.push(`documented without a control: ${name} — the section must name the class that refuses`);
    } else if (!sources.some(([, text]) => text.includes(`class ${control}`))) {
      problems.push(`names a control that does not exist: ${name} -> ${control}`);
    }
  }

  const emitted = declared.filter((d) => (emitters.get(d.key) ?? []).length > 0).length;
  console.log(`security event catalogue: ${declared.length} events declared, ${documented.length} documented, ${emitted} emitted`);
  for (const { key, value } of declared) {
    const sites = emitters.get(key) ?? [];
    if (sites.length > 0) console.log(`  ${value}  <- ${sites.join(', ')}`);
  }

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error('\nA security event that is documented but never emitted is not a control.');
    process.exit(1);
  }
  console.log('\nevery documented security event is declared and emitted');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
