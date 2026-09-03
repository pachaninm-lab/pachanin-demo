#!/usr/bin/env node
// Ratchet for server-side request validation coverage (V2.2.1 / V2.2.2).
//
// The global ValidationPipe in apps/api/src/main.ts is configured correctly
// (whitelist: true, transform: true), but it can only act on a parameter whose
// runtime metatype carries class-validator metadata. Measured, not assumed:
//
//   @Body() body: { name: string }        design:paramtypes -> Object
//   @Body() body: Record<string, unknown> design:paramtypes -> Object
//   @Body() body: RealDto                 design:paramtypes -> RealDto
//
// and the pipe itself, given {name:'ok', smuggled:'x'}:
//
//   metatype RealDto -> {"name":"ok"}                  stripped and checked
//   metatype Object  -> {"name":"ok","smuggled":"x"}   neither
//
// So a handler that types its body inline is unvalidated no matter how well the
// pipe is configured. About half the write surface is in that state, and
// converting every endpoint in one change is exactly the sweeping migration the
// programme forbids.
//
// This gate enforces what can be enforced honestly today:
//   1. no FILE may raise its number of unvalidated @Body() parameters, so the
//      debt can shrink but never grow - and a new one cannot hide behind a
//      deletion somewhere else, which a single global ceiling would allow;
//   2. the number of DTO-typed parameters may never fall, so an existing DTO
//      cannot be downgraded back to an inline type while some unrelated
//      unvalidated endpoint is deleted to keep the ceiling intact.
//
// It does NOT claim the API validates its input. Run with --update-baseline
// after a slice that genuinely converts endpoints.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SOURCE_ROOT = process.env.REQUEST_VALIDATION_ROOT ?? 'apps/api/src';
const BASELINE_PATH = process.env.REQUEST_VALIDATION_BASELINE ?? 'docs/security/request-validation-baseline.json';
const UPDATE = process.argv.includes('--update-baseline');

// @Body(...) then the parameter name then its type annotation.
const BODY_PARAMETER = /@Body\(([^)]*)\)\s*([A-Za-z_$][\w$]*)\s*:\s*/gu;
// Types that erase to Object at runtime, which is what the pipe skips.
const ERASES_TO_OBJECT = /^(?:any|unknown|object|Object|Record|string|String|number|Number|boolean|Boolean)\b/u;

function trackedSources(root) {
  const output = execFileSync('git', ['ls-files', root], { encoding: 'utf8' });
  return output
    .split('\n')
    .filter((path) => path.endsWith('.ts'))
    .filter((path) => !/\.(?:spec|test|d)\.ts$/u.test(path))
    .sort();
}

export function scanSources(files, read = (file) => readFileSync(file, 'utf8')) {
  const unvalidatedByFile = new Map();
  let validated = 0;

  for (const file of files) {
    const text = read(file);
    for (const match of text.matchAll(BODY_PARAMETER)) {
      const remainder = text.slice(match.index + match[0].length);
      const inlineLiteral = remainder.startsWith('{');
      const named = /^([A-Za-z_$][\w$.]*)/u.exec(remainder);
      const erased = !inlineLiteral && named !== null && ERASES_TO_OBJECT.test(named[1]);

      if (inlineLiteral || erased || named === null) {
        unvalidatedByFile.set(file, (unvalidatedByFile.get(file) ?? 0) + 1);
      } else {
        validated += 1;
      }
    }
  }

  return { unvalidatedByFile, validated };
}

function totalUnvalidated(unvalidatedByFile) {
  let total = 0;
  for (const count of unvalidatedByFile.values()) total += count;
  return total;
}

function main() {
  const files = trackedSources(SOURCE_ROOT);
  const scan = scanSources(files);
  const unvalidated = totalUnvalidated(scan.unvalidatedByFile);

  if (UPDATE) {
    const baseline = {
      schemaVersion: 1,
      note: 'Ratchet baseline for V2.2.1/V2.2.2. Per-file unvalidated @Body() counts may fall but never rise; the DTO-typed total may rise but never fall. Not a claim that the API validates its input.',
      minValidatedBodyParameters: scan.validated,
      unvalidatedBodyParametersByFile: Object.fromEntries(
        [...scan.unvalidatedByFile.entries()].sort(([a], [b]) => (a < b ? -1 : 1)),
      ),
    };
    writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`REQUEST_VALIDATION: baseline written - ${unvalidated} unvalidated across ${scan.unvalidatedByFile.size} files, ${scan.validated} validated`);
    return 0;
  }

  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch (error) {
    console.error(`REQUEST_VALIDATION: FAIL_CLOSED - cannot read baseline ${BASELINE_PATH}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  const requiredValidated = Number(baseline.minValidatedBodyParameters);
  if (!Number.isInteger(requiredValidated) || requiredValidated < 0) {
    console.error('REQUEST_VALIDATION: FAIL_CLOSED - baseline minValidatedBodyParameters is not a non-negative integer');
    return 1;
  }

  const ceilingByFile = baseline.unvalidatedBodyParametersByFile;
  if (ceilingByFile === null || typeof ceilingByFile !== 'object' || Array.isArray(ceilingByFile)) {
    console.error('REQUEST_VALIDATION: FAIL_CLOSED - baseline unvalidatedBodyParametersByFile is not an object');
    return 1;
  }
  for (const [file, count] of Object.entries(ceilingByFile)) {
    if (!Number.isInteger(count) || count < 0) {
      console.error(`REQUEST_VALIDATION: FAIL_CLOSED - baseline count for ${file} is not a non-negative integer`);
      return 1;
    }
  }

  const failures = [];
  for (const [file, count] of [...scan.unvalidatedByFile.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const allowed = ceilingByFile[file] ?? 0;
    if (count > allowed) {
      failures.push(`${file}: ${count} unvalidated @Body() parameters, baseline allows ${allowed}`);
    }
  }

  if (scan.validated < requiredValidated) {
    failures.push(`DTO-typed @Body() parameters fell from ${requiredValidated} to ${scan.validated}; a parameter already validated must not be downgraded to an inline type`);
  }

  const total = unvalidated;
  console.log(`REQUEST_VALIDATION: ${total} unvalidated @Body() parameters across ${scan.unvalidatedByFile.size} files; ${scan.validated} validated by a DTO class`);
  console.log('  This is not a claim that the API validates its input. The debt is tracked in the ASVS matrix under V2.2.1 and V2.2.2.');

  if (failures.length > 0) {
    console.error('REQUEST_VALIDATION: FAIL');
    for (const failure of failures) console.error(`  ${failure}`);
    return 1;
  }

  const slack = [];
  for (const [file, allowed] of Object.entries(ceilingByFile)) {
    const actual = scan.unvalidatedByFile.get(file) ?? 0;
    if (actual < allowed) slack.push(`${file}: ${allowed} -> ${actual}`);
  }
  if (slack.length > 0) {
    console.log(`note: ${slack.length} file(s) now below baseline; run --update-baseline to tighten the ratchet.`);
  }
  if (scan.validated > requiredValidated) {
    console.log(`note: DTO-typed parameters rose to ${scan.validated}; run --update-baseline to tighten the floor.`);
  }

  console.log('REQUEST_VALIDATION: WITHIN_BASELINE');
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
