#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const argv = process.argv.slice(2);

function valueAfter(name) {
  const index = argv.indexOf(name);
  if (index < 0) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

const root = resolve(valueAfter('--root') || process.cwd());
const outputPath = valueAfter('--output');
const summaryOnly = argv.includes('--summary');
const failOnPublic = argv.includes('--fail-on-public');
const failOnActive = argv.includes('--fail-on-active');

const excludedPrefixes = [
  '.git/',
  'node_modules/',
  '.next/',
  'dist/',
  'build/',
  'coverage/',
  '.turbo/',
  '.venv/',
  'venv/',
  '__pycache__/',
];

const contentPatterns = [
  {
    id: 'legacy-upper-token',
    expression: String.raw`\bTAI\b`,
    flags: 'gu',
    legacy: true,
  },
  {
    id: 'legacy-pascal-token',
    expression: String.raw`\bTai\b`,
    flags: 'gu',
    legacy: true,
  },
  {
    id: 'legacy-lower-token',
    expression: String.raw`(^|[^A-Za-z0-9])tai(?=$|[^A-Za-z0-9])`,
    flags: 'gu',
    legacy: true,
    leadingCapture: true,
  },
  {
    id: 'forbidden-latin-spelling',
    expression: String.raw`\b(?:Gekto|Hekta|Gecta)\b`,
    flags: 'gu',
    legacy: false,
  },
  {
    id: 'forbidden-russian-spelling',
    expression: String.raw`\bГекто\b`,
    flags: 'gu',
    legacy: false,
  },
];

function trackedFiles() {
  const result = execFileSync('git', ['-C', root, 'ls-files', '-z'], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  return result
    .split('\0')
    .filter(Boolean)
    .filter((path) => !excludedPrefixes.some((prefix) => path.startsWith(prefix)));
}

function classifyPath(path) {
  const lower = path.toLowerCase();

  if (lower.startsWith('docs/gekta/') || lower.includes('gekta-rebrand-governance')) {
    return 'governance';
  }

  if (
    lower.includes('/migrations/')
    || lower.startsWith('apps/api/prisma/migrations/')
    || lower.includes('/immutable-evidence/')
  ) {
    return 'immutable-history-candidate';
  }

  if (
    lower.startsWith('apps/web/')
    || lower.startsWith('apps/landing/')
    || lower.startsWith('public/')
    || lower.includes('/public/')
  ) {
    return 'public';
  }

  if (
    lower.includes('/test/')
    || lower.includes('/tests/')
    || lower.endsWith('.test.ts')
    || lower.endsWith('.test.tsx')
    || lower.endsWith('.spec.ts')
    || lower.endsWith('.spec.tsx')
    || lower.startsWith('e2e/')
  ) {
    return 'test';
  }

  if (
    lower.startsWith('.github/')
    || lower.startsWith('scripts/')
    || lower.startsWith('infra/')
    || lower.includes('dockerfile')
    || lower.includes('compose')
    || lower.includes('caddy')
  ) {
    return 'operations';
  }

  if (lower.startsWith('docs/') || lower.endsWith('.md')) {
    return 'documentation';
  }

  return 'active-code';
}

function pathHasLegacyToken(path) {
  return /(^|[\/_.-])tai(?=$|[\/_.-])/iu.test(path);
}

function lineAndColumn(text, index) {
  const before = text.slice(0, index);
  const line = before.split('\n').length;
  const lastNewline = before.lastIndexOf('\n');
  return {
    line,
    column: index - lastNewline,
  };
}

function countBy(items, keySelector) {
  const counts = {};
  for (const item of items) {
    const key = keySelector(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function scanFile(path) {
  const absolute = resolve(root, path);
  const buffer = readFileSync(absolute);
  const classification = classifyPath(path);
  const occurrences = [];

  if (pathHasLegacyToken(path)) {
    occurrences.push({
      pattern: 'legacy-path-token',
      legacy: true,
      line: null,
      column: null,
      sample: path,
    });
  }

  if (buffer.includes(0)) {
    return occurrences.length
      ? { path, classification, binary: true, occurrences }
      : null;
  }

  const text = buffer.toString('utf8');

  for (const pattern of contentPatterns) {
    const regex = new RegExp(pattern.expression, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const leading = pattern.leadingCapture ? (match[1]?.length || 0) : 0;
      const index = match.index + leading;
      const token = pattern.leadingCapture ? match[0].slice(leading) : match[0];
      const position = lineAndColumn(text, index);
      const lineStart = text.lastIndexOf('\n', index - 1) + 1;
      const lineEndRaw = text.indexOf('\n', index);
      const lineEnd = lineEndRaw < 0 ? text.length : lineEndRaw;
      occurrences.push({
        pattern: pattern.id,
        legacy: pattern.legacy,
        line: position.line,
        column: position.column,
        token,
        sample: text.slice(lineStart, lineEnd).trim().slice(0, 240),
      });

      if (match[0].length === 0) regex.lastIndex += 1;
    }
  }

  return occurrences.length
    ? { path, classification, binary: false, occurrences }
    : null;
}

function main() {
  const files = trackedFiles();
  const records = [];

  for (const path of files) {
    const record = scanFile(path);
    if (record) records.push(record);
  }

  const occurrenceRows = records.flatMap((record) => record.occurrences.map((occurrence) => ({
    path: record.path,
    classification: record.classification,
    ...occurrence,
  })));

  const legacyRows = occurrenceRows.filter((row) => row.legacy);
  const forbiddenRows = occurrenceRows.filter((row) => !row.legacy);
  const publicLegacy = legacyRows.filter((row) => row.classification === 'public');
  const activeLegacy = legacyRows.filter((row) => [
    'public',
    'active-code',
    'operations',
    'documentation',
    'test',
  ].includes(row.classification));

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    root,
    canonical: {
      ru: 'Гекта',
      latin: 'Gekta',
      technical: 'gekta',
      environmentPrefix: 'GEKTA_',
    },
    summary: {
      trackedFilesScanned: files.length,
      filesWithMatches: records.length,
      totalOccurrences: occurrenceRows.length,
      legacyOccurrences: legacyRows.length,
      forbiddenSpellingOccurrences: forbiddenRows.length,
      publicLegacyOccurrences: publicLegacy.length,
      activeLegacyOccurrences: activeLegacy.length,
      filesByClassification: countBy(records, (record) => record.classification),
      occurrencesByClassification: countBy(occurrenceRows, (row) => row.classification),
      occurrencesByPattern: countBy(occurrenceRows, (row) => row.pattern),
    },
    records,
  };

  const rendered = `${JSON.stringify(summaryOnly ? report.summary : report, null, 2)}\n`;

  if (outputPath) {
    const absoluteOutput = resolve(root, outputPath);
    mkdirSync(dirname(absoluteOutput), { recursive: true });
    writeFileSync(absoluteOutput, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  process.stdout.write(rendered);

  if (forbiddenRows.length > 0) process.exitCode = 4;
  if (failOnPublic && publicLegacy.length > 0) process.exitCode = 2;
  if (failOnActive && activeLegacy.length > 0) process.exitCode = 3;
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`gekta-rebrand-inventory: ${message}\n`);
  process.exitCode = 1;
}
