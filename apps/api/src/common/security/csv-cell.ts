/**
 * Output encoding for the CSV reports this application generates.
 *
 * Two separate problems, and only the first is about CSV being well-formed.
 *
 * 1. Structure. A value containing a double quote ends the quoted field early,
 *    and everything after it is read as further columns. `buildRosstatCsv`
 *    wrote `"${culture}"` with no escaping, and `culture` is a free-text
 *    column, so a culture named `","` did not produce a row describing that
 *    culture - it produced a row with different columns. RFC 4180 escapes a
 *    quote by doubling it.
 *
 * 2. Formula execution. A cell whose first character is =, +, - or @ is
 *    evaluated as a formula by Excel and LibreOffice when the file is opened.
 *    The CSV is perfectly well-formed; the injection happens in the reader,
 *    not the parser. This matters here specifically because the reader is a
 *    regulator opening a report we sent them.
 *
 * Both are handled in one place so a new report cannot get one and miss the
 * other, which is how `exportLedgerCsv` came to double its quotes correctly
 * while having no defence at all against the second problem.
 */

/**
 * The characters ASVS 5.0 V1.2.10 names: =, +, -, @, tab and NUL. Carriage
 * return is added because a leading one is stripped by some readers, which
 * exposes whatever character sits behind it.
 */
const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\0', '\r']);

/**
 * Renders one value as a quoted CSV field that cannot change the shape of the
 * row and cannot be executed by the program that opens it.
 *
 * The formula guard prefixes a single quote, which spreadsheets read as "the
 * rest of this cell is text". It is deliberately visible: silently deleting
 * the character would change a value in a regulatory report, and a report that
 * quietly disagrees with the database is worse than one with a visible mark.
 * A negative number is affected by this too - that is the cost, and it is
 * taken knowingly, because a reader cannot distinguish -1 the quantity from
 * -1+cmd() the payload by looking at the first character either.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const raw = String(value);
  const guarded = raw.length > 0 && FORMULA_TRIGGERS.has(raw[0]) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/gu, '""')}"`;
}

/** Renders one row from already-ordered values. */
export function csvRow(values: readonly unknown[]): string {
  return values.map(csvCell).join(',');
}
