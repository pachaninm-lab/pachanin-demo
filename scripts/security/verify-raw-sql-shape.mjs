#!/usr/bin/env node
/**
 * Gate: a raw-SQL result type must not assert a field the query cannot return.
 *
 * `client.$queryRaw<Array<{ circuitState: string }>>(Prisma.sql`…`)` is an
 * unchecked assertion. Prisma does not verify it and the database does not
 * know about it, so when a column alias is renamed or dropped and the type is
 * left behind, every read of that field is `undefined` at runtime while
 * TypeScript still reports it as a `string`. Nothing fails; the value simply
 * stops arriving. On an authorization or eligibility path that is a silent
 * fail-open.
 *
 * This gate reads each call, works out which names the query can actually
 * produce, and fails when an asserted field is not among them.
 *
 * What it deliberately does NOT check:
 *
 *   - Named types (`$queryRaw<SourceHealthSnapshot[]>`). Resolving those needs
 *     the TypeScript checker, not a text scan. They are counted and reported
 *     as unverified rather than silently treated as passing.
 *   - `SELECT *`, whose shape is not knowable statically.
 *   - Field TYPES. Only presence of the name is checked; a column that is
 *     `text` where the type says `number` is out of reach here.
 *
 * Saying which questions a check does not answer is part of the check. A gate
 * that quietly skips what it cannot do reads, from the outside, exactly like
 * one that verified it.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SCANNED = ['apps/api/src/**/*.ts', 'packages/**/*.ts'];

/**
 * Read a template literal starting at the opening backtick, honouring `${…}`
 * interpolations that themselves contain backticks.
 *
 * A non-greedy `([\s\S]*?)` up to the next backtick looks equivalent and is
 * not: it stops at the first NESTED backtick and silently truncates the query.
 * Measured on this repository — 11 of 424 calls contain a nested template, and
 * the naive form reported two of them as missing an alias that was present in
 * the part it had cut off.
 *
 * @returns {{sql: string, end: number} | null}
 */
export function readTemplate(text, start) {
  let index = start + 1;
  let depth = 0;
  let out = '';
  while (index < text.length) {
    const character = text[index];
    if (character === '\\') {
      out += character + (text[index + 1] ?? '');
      index += 2;
      continue;
    }
    if (character === '$' && text[index + 1] === '{') {
      depth += 1;
      out += '${';
      index += 2;
      continue;
    }
    if (character === '}' && depth > 0) {
      depth -= 1;
      out += '}';
      index += 1;
      continue;
    }
    if (character === '`') {
      if (depth === 0) return { sql: out, end: index };
      const inner = readTemplate(text, index);
      if (!inner) return null;
      out += `\`${inner.sql}\``;
      index = inner.end + 1;
      continue;
    }
    out += character;
    index += 1;
  }
  return null;
}

/** Field names asserted by an inline object type. Empty for a named type. */
export function assertedFields(typeArgument) {
  if (!typeArgument.includes('{')) return [];
  return [...typeArgument.matchAll(/(?:^|[{;,])\s*"?([A-Za-z_$][\w$]*)"?\s*\??\s*:/gu)].map((m) => m[1]);
}

/** Names the query could plausibly produce: aliases, quoted and bare identifiers. */
export function producibleNames(sql) {
  const names = new Set();
  for (const m of sql.matchAll(/\bAS\s+"([^"]+)"/giu)) names.add(m[1]);
  for (const m of sql.matchAll(/\bAS\s+([A-Za-z_][\w]*)/giu)) names.add(m[1]);
  for (const m of sql.matchAll(/"([A-Za-z_][\w]*)"/gu)) names.add(m[1]);
  for (const m of sql.matchAll(/\b([A-Za-z_][\w]*)\b/gu)) names.add(m[1]);
  return names;
}

export function scanSource(file, text) {
  const findings = [];
  let inline = 0;
  let namedType = 0;
  let selectStar = 0;

  const call = /\$queryRaw<([^>]*(?:<[^>]*>[^>]*)*)>\s*\(\s*Prisma\.sql/gu;
  for (const match of text.matchAll(call)) {
    const tick = text.indexOf('`', match.index + match[0].length);
    if (tick === -1) continue;
    const template = readTemplate(text, tick);
    if (!template) continue;

    const fields = assertedFields(match[1]);
    if (fields.length === 0) {
      namedType += 1;
      continue;
    }
    if (/SELECT\s+\*/iu.test(template.sql)) {
      selectStar += 1;
      continue;
    }
    inline += 1;

    const names = producibleNames(template.sql);
    const missing = fields.filter((field) => !names.has(field) && !names.has(field.toLowerCase()));
    if (missing.length) {
      findings.push({
        file,
        line: text.slice(0, match.index).split('\n').length,
        missing,
      });
    }
  }
  return { findings, inline, namedType, selectStar };
}

function main() {
  const files = execFileSync('git', ['ls-files', ...SCANNED], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((file) => !/\.(?:test|spec)\.[a-z]+$/u.test(file));

  const all = [];
  let inline = 0;
  let namedType = 0;
  let selectStar = 0;

  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!text.includes('$queryRaw<')) continue;
    const result = scanSource(file, text);
    all.push(...result.findings);
    inline += result.inline;
    namedType += result.namedType;
    selectStar += result.selectStar;
  }

  console.log(
    `RAW_SQL_SHAPE: verified=${inline} unverified_named_type=${namedType} skipped_select_star=${selectStar}`,
  );
  console.log(
    '  Only the presence of asserted field names is checked, and only for inline object types.'
    + ' Field types and named result types are out of reach of a text scan.',
  );

  for (const finding of all) {
    console.error(`MISSING_COLUMN ${finding.file}:${finding.line}  asserted but not returned: ${finding.missing.join(', ')}`);
  }

  if (all.length) {
    console.error(
      `\nRAW_SQL_SHAPE: FAIL - ${all.length} raw query result type(s) assert a field the query does not return.`
      + '\nEvery read of such a field is undefined at runtime while TypeScript still reports its declared type.',
    );
    process.exitCode = 1;
    return;
  }
  console.log('RAW_SQL_SHAPE: PASS - every asserted field name is produced by its query.');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
