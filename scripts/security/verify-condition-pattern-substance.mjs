#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Fails when an ASVS condition is satisfied by a sentence instead of by code.
 *
 * The falsifiability verifier already proves every condition stops holding when
 * its evidence is destroyed. That is a different question from this one. A
 * condition whose pattern appears in the cited file only inside a comment is
 * perfectly falsifiable - delete the comment and it fails - and proves nothing,
 * because what it is anchored to is a description of a control rather than the
 * control. This programme's standing rule is that policy is not implementation;
 * this is that rule made mechanical.
 *
 * The check is deliberately narrow. A pattern inside a STRING literal is not
 * flagged: `'aes-256-gcm'`, `'denied'` and `"__Host-"` are code doing its job,
 * and treating a string as prose would condemn most of the honest conditions in
 * the file. Only a comment is prose by definition.
 *
 * One condition in this repository does mean its comment. V13.4.5 records that a
 * health endpoint is "labelled internal-only in its own source comment while
 * being publicly reachable" - the finding IS the contradiction between what the
 * comment claims and what the code does. That is legitimate and rare, so it is
 * declared rather than inferred: a condition may carry `proseEvidence: true`,
 * which this check honours and which a reader can see. Inferring the exception
 * from the condition's wording would let any condition claim it by accident.
 *
 * Matching mirrors build-asvs-matrix.mjs exactly - case-insensitive substring,
 * newlines included - because a check that matched differently from the thing it
 * audits would report on conditions nobody has.
 */

const PRESENT_CHECKS = new Set(['PRESENT_AT_PATH', 'PRESENT_ALL_AT_PATH']);

const LINE_COMMENT = new Map([
  ['.ts', '//'], ['.tsx', '//'], ['.js', '//'], ['.jsx', '//'], ['.mjs', '//'], ['.cjs', '//'],
  ['.py', '#'], ['.yml', '#'], ['.yaml', '#'], ['.sh', '#'], ['.toml', '#'],
  ['.sql', '--'], ['.prisma', '//'], ['.css', null], ['.scss', '//'],
]);
const BLOCK_COMMENTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.sql', '.css', '.scss', '.prisma']);

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

/**
 * The same text with every comment replaced by spaces, and every string literal
 * left exactly as it was.
 *
 * Positions are preserved so a caller can compare occurrence counts rather than
 * guess. The scanner tracks quotes because `'// not a comment'` is a string, and
 * a stripper that did not know the difference would erase working code and call
 * a real control prose.
 */
export function stripComments(source, extension) {
  const line = LINE_COMMENT.get(extension);
  const block = BLOCK_COMMENTS.has(extension);
  if (line === undefined && !block) return source;
  const out = source.split('');
  let index = 0;
  let quote = null;
  while (index < source.length) {
    const character = source[index];
    if (quote) {
      if (character === '\\') { index += 2; continue; }
      if (character === quote) quote = null;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') { quote = character; index += 1; continue; }
    if (block && character === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      const stop = end === -1 ? source.length : end + 2;
      for (let position = index; position < stop; position += 1) if (out[position] !== '\n') out[position] = ' ';
      index = stop;
      continue;
    }
    if (line && source.startsWith(line, index)) {
      let stop = source.indexOf('\n', index);
      if (stop === -1) stop = source.length;
      for (let position = index; position < stop; position += 1) out[position] = ' ';
      index = stop;
      continue;
    }
    index += 1;
  }
  return out.join('');
}

/** Exactly how build-asvs-matrix.mjs matches: case-insensitive substring. */
export function occurrences(text, pattern) {
  if (!pattern) return 0;
  const haystack = text.toLowerCase();
  const needle = pattern.toLowerCase();
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return count;
    count += 1;
    from = at + needle.length;
  }
}

/**
 * A pattern is prose-only at a path when it occurs there, and every one of those
 * occurrences disappears once comments are removed.
 */
export function isProseOnly(source, extension, pattern) {
  const present = occurrences(source, pattern);
  if (present === 0) return false;
  return occurrences(stripComments(source, extension), pattern) === 0;
}

function main() {
  const decisions = JSON.parse(readFileSync('docs/security/asvs-applicability-decisions.json', 'utf8')).decisions ?? [];
  const cache = new Map();
  const read = (path) => {
    if (!cache.has(path)) cache.set(path, existsSync(path) ? readFileSync(path, 'utf8') : null);
    return cache.get(path);
  };

  const proseOnly = [];
  let checked = 0;
  let declared = 0;
  for (const decision of decisions) {
    for (const condition of decision.conditions ?? []) {
      if (!PRESENT_CHECKS.has(condition.check)) continue;
      for (const path of condition.paths ?? []) {
        const source = read(path);
        if (source === null) continue;
        const extension = extname(path).toLowerCase();
        for (const pattern of condition.patterns ?? []) {
          checked += 1;
          if (condition.proseEvidence === true) { declared += 1; continue; }
          if (isProseOnly(source, extension, pattern)) {
            proseOnly.push({ requirementId: decision.requirementId, path, pattern, status: decision.status });
          }
        }
      }
    }
  }

  console.log(`condition pattern substance: ${checked} pattern-at-path pair(s) checked across ${decisions.length} decisions; ${declared} declared proseEvidence`);
  if (!proseOnly.length) {
    console.log('  Every PRESENT pattern is matched by code, not by a comment describing it.');
    return 0;
  }
  console.error(`condition pattern substance FAILED: ${proseOnly.length} pattern(s) are matched only inside a comment`);
  for (const entry of proseOnly) {
    console.error(`- ${entry.requirementId} (${entry.status}) ${entry.path}: ${JSON.stringify(entry.pattern)}`);
  }
  console.error('  A condition anchored to a comment proves the control was described, not that it exists.');
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
