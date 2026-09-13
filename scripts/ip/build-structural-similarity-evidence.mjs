#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Screens the protected core for copies that survive renaming.
 *
 * The token screening in build-offline-similarity-evidence.mjs publishes its own
 * blind spot, measured rather than supposed: a verbatim 1838-line copy of
 * pydantic/main.py with every non-keyword identifier renamed is not detected by
 * any of its three methods. Normalisation replaces strings, numbers, comments and
 * whitespace - it does not replace identifiers, and the winnowing fingerprint is
 * computed over tokens that include them. Renaming is also the cheapest possible
 * laundering: one editor command.
 *
 * This tool compares shape instead of text. Each file is parsed and reduced to the
 * pre-order sequence of its syntax node kinds - nothing else. Every identifier,
 * string, number and comment is gone by construction, so a renamed copy has the
 * identical sequence and an unrelated file does not.
 *
 * Shape is a coarser signal than text, so it is treated as coarser:
 *
 *   - A shape is only comparable if it is big enough not to be generic. Small
 *     files share shapes for no reason at all, and the floor is a stated number
 *     rather than a tuned one (see MIN_SHAPE_NODES).
 *   - Shapes are compared only within a language. TypeScript node kinds and Python
 *     node types are different vocabularies, so the Python ids are offset and a
 *     cross-language match cannot occur even by accident.
 *   - A file that cannot be parsed is reported, never skipped. Silently dropping
 *     unparseable files is how a screening run reports a clean result for files it
 *     never looked at, which is the failure this programme has already made once.
 */

const outDir = process.argv[2] ?? 'artifacts/ip-clean-room/structural';
const corpusInput = String(process.env.IP_SIMILARITY_CORPUS ?? '').trim();
/** Override the interpreter used to parse Python. Otherwise the newest one that
 *  can parse the whole protected core is chosen, because apps/tai declares
 *  requires-python >= 3.12 and an older interpreter rejects its files as syntax
 *  errors rather than reading them. */
const pythonOverride = String(process.env.IP_PYTHON ?? '').trim();
/**
 * Which of our files to screen. 'core' is the protected boundary - 660 files with
 * a parser, of which 532 are large enough to compare. 'all-tracked' is every
 * tracked file in a language we can parse, which is roughly seven times as many.
 *
 * The core is where the crown jewels are, but it is not where borrowed code is
 * likeliest to land: nobody reviews the application shell. Screening only the
 * boundary and reporting the result as "the code is original" is the same
 * coverage overstatement this programme already made once with Python.
 */
const scope = String(process.env.IP_STRUCTURAL_SCOPE ?? 'core').trim().toLowerCase();
if (!['core', 'all-tracked'].includes(scope)) {
  throw new Error(`IP_STRUCTURAL_SCOPE must be 'core' or 'all-tracked', got ${JSON.stringify(scope)}`);
}

/**
 * A shape below this many nodes is not evidence of anything. The number is not
 * tuned against the result: it is the size at which a shape stops being a shape
 * every codebase contains. Calibration and the measured effect of moving it are
 * published with the run.
 */
const MIN_SHAPE_NODES = 200;
/** Structure tokens come from an alphabet of a few hundred kinds, so a gram must
 *  be much longer than the 12 source tokens the text screening uses before it
 *  identifies anything. */
const GRAM_SIZE = 30;
const WINDOW_SIZE = 12;
/** Reported as a finding for review. Not a verdict: every finding is classified
 *  by hand and the classification is what the record carries. */
const JACCARD_REPORT_AT = 0.75;
const PYTHON_KIND_OFFSET = 100_000;

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const PY_EXTENSIONS = new Set(['.py']);
const excludedPath = /(^|\/)(tests?|fixtures?|snapshots?|node_modules|dist|build|generated)(\/|$)/i;

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fnv1a32(values) {
  let hash = 0x811c9dc5;
  for (const value of values) {
    hash ^= value & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    hash ^= (value >>> 8) & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    hash ^= (value >>> 16) & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function winnowShape(shape, gramSize = GRAM_SIZE, windowSize = WINDOW_SIZE) {
  if (shape.length < gramSize) return [];
  const grams = new Array(shape.length - gramSize + 1);
  for (let index = 0; index < grams.length; index += 1) {
    grams[index] = fnv1a32(shape.slice(index, index + gramSize));
  }
  if (grams.length <= windowSize) return [...new Set([Math.min(...grams)])];
  const selected = new Set();
  for (let index = 0; index <= grams.length - windowSize; index += 1) {
    let best = grams[index];
    for (let offset = 1; offset < windowSize; offset += 1) {
      if (grams[index + offset] < best) best = grams[index + offset];
    }
    selected.add(best);
  }
  return [...selected].sort((left, right) => left - right);
}

export function jaccard(left, right) {
  if (left.length === 0 || right.length === 0) return 0;
  const smaller = left.length <= right.length ? left : right;
  const larger = left.length <= right.length ? right : left;
  const lookup = new Set(larger);
  let shared = 0;
  for (const value of smaller) if (lookup.has(value)) shared += 1;
  return shared / (left.length + right.length - shared);
}

const ts = await import(resolve('apps/api/node_modules/typescript/lib/typescript.js'))
  .then((module) => module.default ?? module)
  .catch(() => null);

export function typescriptShape(text, fileName, tsApi = ts) {
  if (!tsApi) throw new Error('The TypeScript parser is not installed; run the workspace install first.');
  const source = tsApi.createSourceFile(fileName, text, tsApi.ScriptTarget.Latest, false, undefined);
  const shape = [];
  const visit = (node) => {
    shape.push(node.kind);
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  // A parse error does not throw in this API; it is recorded on the source file,
  // and a file parsed as garbage would otherwise contribute a garbage shape.
  const diagnostics = source.parseDiagnostics ?? [];
  return { shape, parseErrors: diagnostics.length };
}

function pythonCandidates() {
  if (pythonOverride) return [pythonOverride];
  return ['python3.13', 'python3.12', 'python3.11', 'python3'];
}

function runPythonShapes(interpreter, paths) {
  const helper = resolve(fileURLToPath(new URL('./structural-python-shape.py', import.meta.url)));
  const result = spawnSync(interpreter, [helper], {
    input: `${paths.join('\n')}\n`,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) return null;
  const shapes = new Map();
  const failures = [];
  for (const line of result.stdout.split('\n')) {
    if (!line) continue;
    const record = JSON.parse(line);
    if (record.error) { failures.push({ path: record.path, error: record.error }); continue; }
    shapes.set(record.path, record.shape);
  }
  return { shapes, failures };
}

/** Distinct node-type names get stable ids, offset so no Python shape can share a
 *  gram with a TypeScript shape. */
const pythonKindIds = new Map();
function pythonKindId(name) {
  let id = pythonKindIds.get(name);
  if (id === undefined) {
    id = PYTHON_KIND_OFFSET + pythonKindIds.size;
    pythonKindIds.set(name, id);
  }
  return id;
}

function walkCorpus(directory, base = directory) {
  const files = [];
  const stack = [directory];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) { stack.push(absolute); continue; }
      if (!entry.isFile()) continue;
      const path = relative(base, absolute).replaceAll('\\', '/');
      if (excludedPath.test(path)) continue;
      const extension = extname(path).toLowerCase();
      if (!TS_EXTENSIONS.has(extension) && !PY_EXTENSIONS.has(extension)) continue;
      files.push({ absolute, path, extension });
    }
  }
  return files;
}

function csv(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function main() {
  mkdirSync(outDir, { recursive: true });
  const boundary = JSON.parse(readFileSync('docs/ip/proprietary-core-boundary.json', 'utf8'));
  const protectedRoots = (boundary.protectedRoots ?? []).map((entry) => entry.path);
  const pathspec = scope === 'all-tracked' ? [] : protectedRoots;

  const protectedPaths = git(['ls-files', '-z', '--', ...pathspec])
    .split('\0')
    .filter(Boolean)
    .filter((path) => !excludedPath.test(path))
    .filter((path) => TS_EXTENSIONS.has(extname(path).toLowerCase()) || PY_EXTENSIONS.has(extname(path).toLowerCase()));

  const blockers = [];
  const unparseable = [];

  // --- Python interpreter selection -----------------------------------------
  const protectedPython = protectedPaths.filter((path) => PY_EXTENSIONS.has(extname(path).toLowerCase()));
  let interpreter = null;
  let interpreterVersion = 'NONE';
  let protectedPythonShapes = new Map();
  if (protectedPython.length) {
    for (const candidate of pythonCandidates()) {
      const attempt = runPythonShapes(candidate, protectedPython);
      if (!attempt) continue;
      if (interpreter === null || attempt.failures.length === 0) {
        interpreter = candidate;
        protectedPythonShapes = attempt.shapes;
        if (attempt.failures.length === 0) break;
        unparseable.length = 0;
        for (const failure of attempt.failures) unparseable.push({ ...failure, scope: 'protected' });
      }
    }
    if (interpreter === null) blockers.push('NO_PYTHON_INTERPRETER');
    else {
      interpreterVersion = spawnSync(interpreter, ['--version'], { encoding: 'utf8' }).stdout.trim()
        || spawnSync(interpreter, ['--version'], { encoding: 'utf8' }).stderr.trim();
    }
  }

  // --- protected shapes ------------------------------------------------------
  const fingerprints = [];
  for (const path of protectedPaths) {
    const extension = extname(path).toLowerCase();
    let shape = null;
    if (PY_EXTENSIONS.has(extension)) {
      const raw = protectedPythonShapes.get(path);
      if (!raw) { if (!unparseable.some((entry) => entry.path === path)) unparseable.push({ path, error: 'NOT_PARSED', scope: 'protected' }); continue; }
      shape = raw.map(pythonKindId);
    } else {
      const parsed = typescriptShape(readFileSync(path, 'utf8'), path);
      if (parsed.parseErrors > 0) { unparseable.push({ path, error: `TS_PARSE_ERRORS:${parsed.parseErrors}`, scope: 'protected' }); continue; }
      shape = parsed.shape;
    }
    fingerprints.push({
      path,
      language: PY_EXTENSIONS.has(extension) ? 'python' : 'typescript',
      nodes: shape.length,
      comparable: shape.length >= MIN_SHAPE_NODES,
      shapeSha256: sha256(shape.join(',')),
      winnowing: shape.length >= MIN_SHAPE_NODES ? winnowShape(shape) : [],
    });
  }

  // --- corpus ----------------------------------------------------------------
  const findings = [];
  let corpusFiles = 0;
  let corpusComparable = 0;
  let corpusUnparseable = 0;
  let status = 'CORPUS_REQUIRED';
  if (!corpusInput) {
    blockers.push('OFFLINE_CORPUS_NOT_PROVIDED');
  } else {
    const corpusRoot = resolve(corpusInput);
    if (!existsSync(corpusRoot) || !lstatSync(corpusRoot).isDirectory()) {
      blockers.push('OFFLINE_CORPUS_NOT_A_DIRECTORY');
    } else {
      const entries = walkCorpus(corpusRoot);
      corpusFiles = entries.length;
      const corpusPython = entries.filter((entry) => PY_EXTENSIONS.has(entry.extension));
      let corpusPythonShapes = new Map();
      if (corpusPython.length && interpreter) {
        const attempt = runPythonShapes(interpreter, corpusPython.map((entry) => entry.absolute));
        if (attempt) {
          corpusPythonShapes = attempt.shapes;
          corpusUnparseable += attempt.failures.length;
        }
      }

      // Inverted index: fingerprint -> protected files carrying it. Built over the
      // protected side because it is three orders of magnitude smaller, so the
      // corpus is streamed once and never held.
      const index = new Map();
      for (let id = 0; id < fingerprints.length; id += 1) {
        for (const value of fingerprints[id].winnowing) {
          let bucket = index.get(value);
          if (!bucket) { bucket = []; index.set(value, bucket); }
          bucket.push(id);
        }
      }
      const shapeIndex = new Map();
      for (let id = 0; id < fingerprints.length; id += 1) {
        const bucket = shapeIndex.get(fingerprints[id].shapeSha256) ?? [];
        bucket.push(id);
        shapeIndex.set(fingerprints[id].shapeSha256, bucket);
      }

      for (const entry of entries) {
        let shape = null;
        if (PY_EXTENSIONS.has(entry.extension)) {
          const raw = corpusPythonShapes.get(entry.absolute);
          if (!raw) continue;
          shape = raw.map(pythonKindId);
        } else {
          let parsed = null;
          try { parsed = typescriptShape(readFileSync(entry.absolute, 'utf8'), entry.path); } catch { corpusUnparseable += 1; continue; }
          if (parsed.parseErrors > 0) { corpusUnparseable += 1; continue; }
          shape = parsed.shape;
        }
        if (shape.length < MIN_SHAPE_NODES) continue;
        corpusComparable += 1;

        const digest = sha256(shape.join(','));
        for (const id of shapeIndex.get(digest) ?? []) {
          findings.push({ source: fingerprints[id].path, corpus: entry.path, method: 'IDENTICAL_SHAPE', score: 1 });
        }

        const winnowing = winnowShape(shape);
        const overlap = new Map();
        for (const value of winnowing) {
          for (const id of index.get(value) ?? []) overlap.set(id, (overlap.get(id) ?? 0) + 1);
        }
        for (const [id, shared] of overlap) {
          const source = fingerprints[id];
          const score = shared / (source.winnowing.length + winnowing.length - shared);
          // Recorded whatever the score is. The reporting threshold is only
          // defensible if the scores it does not report are published too:
          // a threshold of 0.75 means nothing until the best score among the
          // files it cleared is on the record next to it.
          if (score > (source.topScore ?? 0)) { source.topScore = score; source.topMatch = entry.path; }
          if (score < JACCARD_REPORT_AT) continue;
          if (source.shapeSha256 === digest) continue;
          findings.push({ source: source.path, corpus: entry.path, method: 'SHAPE_JACCARD', score });
        }
      }
      status = findings.length ? 'FINDINGS_REVIEW_REQUIRED' : 'NO_STRUCTURAL_FINDINGS';
    }
  }

  if (unparseable.length) blockers.push(`PROTECTED_FILES_NOT_PARSED:${unparseable.length}`);
  if (findings.length) blockers.push(`UNRESOLVED_STRUCTURAL_FINDINGS:${findings.length}`);

  findings.sort((left, right) => right.score - left.score || left.source.localeCompare(right.source));
  const rows = ['finding_id,source_path,corpus_path,method,score'];
  findings.forEach((finding, position) => {
    rows.push([
      `STR-${String(position + 1).padStart(6, '0')}`,
      csv(finding.source), csv(finding.corpus), finding.method, finding.score.toFixed(6),
    ].join(','));
  });
  writeFileSync(join(outDir, 'STRUCTURAL_FINDINGS.csv'), `${rows.join('\n')}\n`);
  writeFileSync(join(outDir, 'structural-fingerprints.json'), `${JSON.stringify({
    schemaVersion: 1,
    minShapeNodes: MIN_SHAPE_NODES,
    gramSize: GRAM_SIZE,
    windowSize: WINDOW_SIZE,
    files: fingerprints.map(({ winnowing, topScore, topMatch, ...rest }) => ({
      ...rest,
      fingerprints: winnowing.length,
      topScore: Number((topScore ?? 0).toFixed(6)),
      topMatch: topMatch ?? null,
    })),
  }, null, 2)}\n`);

  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status,
    scope,
    networkUsed: false,
    pythonInterpreter: interpreterVersion,
    protectedFiles: protectedPaths.length,
    protectedFingerprinted: fingerprints.length,
    protectedComparable: fingerprints.filter((entry) => entry.comparable).length,
    protectedBelowFloor: fingerprints.filter((entry) => !entry.comparable).length,
    protectedNotParsed: unparseable,
    corpusFiles,
    corpusComparable,
    corpusNotParsed: corpusUnparseable,
    minShapeNodes: MIN_SHAPE_NODES,
    jaccardReportAt: JACCARD_REPORT_AT,
    findings: findings.length,
    // The calibration the reporting threshold rests on: the highest shape
    // similarity reached by any protected file that was not reported.
    highestUnreportedScore: Number(Math.max(0, ...fingerprints
      .filter((entry) => entry.comparable && (entry.topScore ?? 0) < JACCARD_REPORT_AT)
      .map((entry) => entry.topScore ?? 0)).toFixed(6)),
    blockers,
    methodology: 'Each file is parsed and reduced to the pre-order sequence of its syntax node kinds. Identifiers, strings, numbers, comments and formatting are discarded by construction, so a copy whose identifiers were renamed has the same shape. Shapes are compared only within a language, only above a stated size floor, and a file that cannot be parsed is reported rather than skipped. A shape match is screening evidence of structure, not proof of copying: independent implementations of the same small pattern can share a shape.',
  };
  writeFileSync(join(outDir, 'structural-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({
    status, scope, protectedFiles: summary.protectedFiles, protectedComparable: summary.protectedComparable,
    protectedNotParsed: unparseable.length, corpusComparable, findings: findings.length, blockers,
  }, null, 2));
  return blockers.length ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
