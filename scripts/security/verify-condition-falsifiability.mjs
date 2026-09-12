#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { evaluateCondition } from './build-asvs-matrix.mjs';

/**
 * A condition that cannot be broken is not evidence.
 *
 * Every decision in the matrix carries conditions that are re-evaluated on each
 * run, and the whole design rests on one property: if the fact a decision stands
 * on stops being true, the condition stops holding and the decision is rejected.
 * Nothing checked that property. It was checked by hand, one requirement at a
 * time, whenever somebody happened to be working nearby - and doing it that way
 * found thirteen distinct shapes of condition that could not revoke:
 *
 *   a pattern matching a token that also appears outside the control;
 *   a condition anchored to a historical migration, which never changes again;
 *   a condition naming one file of a path that runs through four classes;
 *   a condition naming one endpoint of a defect that lives in seven;
 *   a conjunction where only one conjunct was load-bearing.
 *
 * Each was found by accident. This finds them on purpose: for every condition,
 * destroy exactly the evidence it names and require the condition to notice.
 *
 * The mutation is applied to the text the evaluator reads, never to the working
 * tree, so a run cannot leave anything behind and cannot be interrupted into a
 * half-mutated state.
 */

const DECISIONS = 'docs/security/asvs-applicability-decisions.json';

/** Removes every case-insensitive occurrence of a pattern from a file's text. */
export function strip(text, pattern) {
  const needle = String(pattern).toLowerCase();
  if (needle === '') return text;
  let out = '';
  let index = 0;
  const haystack = String(text ?? '');
  const lower = haystack.toLowerCase();
  for (;;) {
    const at = lower.indexOf(needle, index);
    if (at === -1) { out += haystack.slice(index); return out; }
    out += haystack.slice(index, at);
    index = at + needle.length;
  }
}

/**
 * The mutations a condition must notice, one per named piece of evidence.
 *
 * PRESENT_ALL_AT_PATH is expanded per pattern deliberately: its whole reason for
 * existing is that several patterns are combined rather than alternative, and a
 * conjunction whose second conjunct can be deleted without effect is a
 * conjunction in name only.
 */
export function mutationsFor(condition) {
  const patterns = (condition.patterns ?? []).map(String);
  const paths = condition.paths ?? [];
  const roots = condition.roots ?? [];
  const check = condition.check;
  const mutations = [];

  if (check === 'PRESENT_AT_PATH') {
    // Any one path losing every pattern is enough: PRESENT requires them all.
    for (const path of paths) {
      mutations.push({ kind: 'strip', path, patterns, label: `strip all patterns from ${path}` });
    }
  } else if (check === 'PRESENT_ALL_AT_PATH') {
    for (const path of paths) {
      for (const pattern of patterns) {
        mutations.push({ kind: 'strip', path, patterns: [pattern], label: `strip ${JSON.stringify(pattern)} from ${path}` });
      }
    }
  } else if (check === 'ABSENT_AT_PATH') {
    for (const path of paths) {
      for (const pattern of patterns) {
        mutations.push({ kind: 'inject', path, pattern, label: `inject ${JSON.stringify(pattern)} into ${path}` });
      }
    }
  } else if (check === 'ABSENT_IN_TREE' || check === 'NO_RUNTIME_CALLER') {
    for (const pattern of patterns) {
      const root = roots[0];
      if (root === undefined) continue;
      mutations.push({ kind: 'add', path: `${root}/__falsifiability_probe.ts`, pattern, label: `add a source file under ${root} containing ${JSON.stringify(pattern)}` });
    }
  } else if (check === 'ABSENT_IN_MANIFESTS') {
    for (const pattern of patterns) {
      mutations.push({ kind: 'add', path: 'package.json', pattern, manifest: true, label: `declare ${JSON.stringify(pattern)} in package.json` });
    }
  }
  return mutations;
}

function applyMutation(mutation, { tracked, readFile }) {
  if (mutation.kind === 'strip') {
    return {
      tracked,
      readFile: (path) => {
        const text = readFile(path);
        if (path !== mutation.path || text === null) return text;
        let mutated = text;
        for (const pattern of mutation.patterns) mutated = strip(mutated, pattern);
        return mutated;
      },
    };
  }
  if (mutation.kind === 'inject') {
    return {
      tracked,
      readFile: (path) => {
        const text = readFile(path);
        if (path !== mutation.path || text === null) return text;
        return `${text}\n${mutation.pattern}\n`;
      },
    };
  }
  // `add`: a file that did not exist becomes tracked and carries the pattern.
  // A real source file is what an ABSENT_IN_TREE claim is about, so the probe
  // has to be a real one - an export and a function body, not a bare literal,
  // because a module that is nothing but one opaque literal is skipped by the
  // scanner on purpose.
  const body = mutation.manifest
    ? `{"name":"probe","dependencies":{"${mutation.pattern}":"1.0.0"}}`
    : `export function falsifiabilityProbe(input: string): string {\n  return \`\${input} ${mutation.pattern}\`;\n}\n`;
  return {
    tracked: tracked.includes(mutation.path) ? tracked : [...tracked, mutation.path],
    readFile: (path) => {
      if (path !== mutation.path) return readFile(path);
      const existing = readFile(path);
      return existing === null ? body : `${existing}\n${body}`;
    },
  };
}

export function auditCondition(condition, context) {
  const baseline = evaluateCondition(condition, context);
  const mutations = mutationsFor(condition);
  const survived = [];

  for (const mutation of mutations) {
    const mutated = evaluateCondition(condition, applyMutation(mutation, context));
    if (mutated.holds !== false) survived.push(mutation.label);
  }

  return {
    condition: condition.condition,
    check: condition.check,
    holds: baseline.holds,
    mutations: mutations.length,
    survived,
    alternativesOnly: alternativesOnly(condition, context),
  };
}

/**
 * A multi-pattern PRESENT_AT_PATH whose every pattern can be deleted on its own
 * without the condition noticing.
 *
 * That is legal - PRESENT_AT_PATH matches with .some(), so several patterns are
 * alternatives, which is right when they are spellings of one control: a
 * function name and the error code it throws, or `useGlobalPipes` and
 * `ValidationPipe` for the same pipe. It is wrong when the condition's own
 * sentence names several facts, because then the decision stands on whichever
 * one survives. «the audit channel carries who, where and what» with five field
 * names is a conjunction written with the wrong check, and it held while four of
 * the five were missing.
 *
 * So this is reported rather than failed, and the suite pins the set: a new one
 * has to be looked at and either justified as spellings or moved to
 * PRESENT_ALL_AT_PATH.
 */
export function alternativesOnly(condition, context) {
  if (condition.check !== 'PRESENT_AT_PATH') return false;
  const patterns = (condition.patterns ?? []).map(String);
  if (patterns.length < 2) return false;
  if (evaluateCondition(condition, context).holds !== true) return false;
  for (const pattern of patterns) {
    // Stripped from every named path at once: if removing this one pattern
    // everywhere still leaves the condition standing, it is not load-bearing.
    const everywhere = {
      tracked: context.tracked,
      readFile: (path) => {
        const text = context.readFile(path);
        if (!(condition.paths ?? []).includes(path) || text === null) return text;
        return strip(text, pattern);
      },
    };
    if (evaluateCondition(condition, everywhere).holds === false) return false;
  }
  return true;
}

function main() {
  const doc = JSON.parse(readFileSync(DECISIONS, 'utf8'));
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    .split('\n').filter(Boolean);
  const cache = new Map();
  const readFile = (path) => {
    if (!cache.has(path)) {
      try { cache.set(path, readFileSync(path, 'utf8')); } catch { cache.set(path, null); }
    }
    return cache.get(path);
  };
  const context = { tracked, readFile };

  const problems = [];
  const alternatives = [];
  let conditions = 0;
  let mutations = 0;
  let notEvaluable = 0;

  for (const decision of doc.decisions ?? []) {
    for (const condition of decision.conditions ?? []) {
      conditions += 1;
      const audit = auditCondition(condition, context);
      mutations += audit.mutations;
      if (audit.mutations === 0) {
        notEvaluable += 1;
        problems.push({ id: decision.requirementId, kind: 'NO_MUTATION', detail: `${audit.check}: no evidence this harness knows how to destroy`, items: [] });
        continue;
      }
      if (audit.alternativesOnly) {
        alternatives.push(`${decision.requirementId} [${decision.status}] ${condition.patterns.join(' | ')}`);
      }
      if (audit.survived.length > 0) {
        problems.push({
          id: decision.requirementId,
          kind: 'CONDITION_SURVIVES',
          detail: `${audit.check} still holds after its own evidence is destroyed`,
          items: audit.survived,
        });
      }
    }
  }

  console.log(`CONDITION_FALSIFIABILITY: ${conditions} conditions, ${mutations} mutations applied in memory`);
  console.log(`  ${alternatives.length} multi-pattern PRESENT_AT_PATH condition(s) have no single load-bearing pattern:`);
  for (const entry of alternatives) console.log(`    ${entry}`);
  console.log('  Legal where the patterns spell one control; a conjunction belongs in PRESENT_ALL_AT_PATH.');
  console.log('  What this harness CANNOT see: a pattern that matches unrelated text in the file, and a');
  console.log('  condition anchored to a file that in practice never changes. Both revoke when stripped.');
  if (problems.length === 0) {
    console.log('Every condition stopped holding when the evidence it names was destroyed.');
    return 0;
  }
  for (const problem of problems) {
    console.error(`\n${problem.kind} ${problem.id}: ${problem.detail}`);
    for (const item of problem.items.slice(0, 6)) console.error(`  survived: ${item}`);
    if (problem.items.length > 6) console.error(`  ... and ${problem.items.length - 6} more`);
  }
  console.error(`\nCONDITION_FALSIFIABILITY: FAIL - ${problems.length} condition(s) cannot revoke.`);
  console.error('A condition that still holds without its evidence is not evidence; it is a decision standing on nothing.');
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
