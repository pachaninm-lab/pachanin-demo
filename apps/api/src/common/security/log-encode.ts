/**
 * Output encoding for values that reach a log line (ASVS 5.0 V16.4.1).
 *
 * Masking is not encoding. `sensitive-data.ts` strips PII out of a logged
 * string: a different control with a different purpose, deciding WHAT may be
 * written. This one decides how what is written may be SHAPED. A log line
 * assembled from attacker-influenced fields with neither control is forgeable;
 * with masking alone it is still forgeable.
 *
 * Measured against Node's own HTTP parser rather than assumed, because the
 * assumption on record was wrong, and so was the first correction to it. Two
 * statements were checked and discarded before the one below:
 *
 *   "a newline in that header produces a forged additional log line" - the
 *   note on file. It does not. llhttp answers 400 Bad Request to a raw LF, a
 *   raw CR, a NUL, an ESC (0x1b), a DEL (0x7f) and an obs-fold continuation
 *   line, so none of them ever reaches a handler.
 *
 *   "U+2028 passes through intact" - the first replacement, also wrong. Node
 *   decodes header values as latin1, so the three UTF-8 bytes of U+2028 arrive
 *   as three separate code points (U+00E2, U+0080, U+00A8), not as one line
 *   separator.
 *
 * What is true, measured byte by byte on a live server, every case answered
 * 200 OK with the code point intact in `req.headers`: the parser refuses the
 * C0 block and DEL, and passes the WHOLE C1 block, U+0080 to U+009F.
 * Confirmed individually at 0x80, 0x85, 0x9b and 0x9f; 0x7f refused.
 *
 * That block is not decorative:
 *
 *   U+009B  CSI, the 8-bit form of the ANSI escape introducer. ESC itself is
 *           refused; this equivalent is not. Written to a UTF-8 stream it is
 *           encoded as c2 9b, which a UTF-8 terminal tailing the log decodes
 *           back to CSI and obeys - so the attacker repaints lines they do not
 *           own.
 *   U+0085  NEL, a line terminator to a range of log processors.
 *   U+0009  TAB, which shifts columns in any column-aligned reader.
 *
 * U+2028 and U+2029 stay in the class below even though a header cannot
 * deliver them: this helper is general, values reach it from bodies, query
 * strings and the database too, and there they are LineTerminators under
 * ECMA-262 11.3. Covering them costs nothing.
 *
 * Two fields carry this, not one. The record named only User-Agent; with
 * `trust proxy` on, `req.ip` derives from X-Forwarded-For, and the same bytes
 * were measured passing through that header too.
 *
 * Escaping is visible rather than silent, for the reason csv-cell.ts gives: a
 * log that quietly disagrees with what arrived is worse than one carrying a
 * mark. Backslash is escaped FIRST, so the output is unambiguous - otherwise a
 * caller typing the four characters backslash-x-0-a could not be told apart
 * from a control character this function encoded.
 */

/**
 * Longest field kept. A megabyte-long User-Agent is its own denial of service
 * against whoever has to read the log.
 */
const DEFAULT_MAX_LENGTH = 256;

/**
 * C0 controls, DEL, the whole C1 block, and the two Unicode line terminators
 * that are in neither. One class rather than several, so a character cannot be
 * closed in one place and left open in another.
 */
const MUST_ESCAPE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/gu;

function escapeOne(character: string): string {
  const code = character.codePointAt(0) ?? 0;
  return code <= 0xff
    ? `\\x${code.toString(16).padStart(2, '0')}`
    : `\\u${code.toString(16).padStart(4, '0')}`;
}

/**
 * Renders one value so it cannot add, split or repaint a log line.
 *
 * Ordinary text is left alone. This must not become a function that mangles
 * every User-Agent it sees: an unreadable log is also a log nobody reads.
 */
export function encodeLogField(value: unknown, maxLength: number = DEFAULT_MAX_LENGTH): string {
  if (value === null || value === undefined) return '-';
  const raw = String(value);
  const truncated = raw.length > maxLength ? `${raw.slice(0, maxLength)}...[truncated]` : raw;
  return truncated
    .replace(/\\/gu, '\\\\')
    .replace(/"/gu, '\\"')
    .replace(MUST_ESCAPE, escapeOne);
}
