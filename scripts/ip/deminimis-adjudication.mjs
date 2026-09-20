/**
 * De minimis line adjudication.
 *
 * An identity whose rights are UNRESOLVED blocks first-party classification of
 * every file carrying its surviving lines. That rule is deliberately blunt, and
 * it must stay blunt: see scripts/ip/contributor-rights.mjs.
 *
 * This module carves out one narrow, evidenced exception. Some surviving lines
 * carry no expression at all -- blank lines, and no-op comments appended purely
 * to change a commit hash so a CI workflow would re-run. Such a line is not
 * authorship in any meaningful sense, and treating it as a rights blocker
 * overstates the exposure.
 *
 * The carve-out is not a switch. An adjudication must quote the exact content
 * it excuses; the verifier re-reads the real file, and refuses unless the quoted
 * content matches the surviving lines byte for byte AND every one of those lines
 * is independently non-expressive. Drift invalidates it. A line carrying any
 * executable token, or any comment long enough to express something, is never
 * adjudicable -- no register entry can override that.
 *
 * What this is NOT: a finding that the identity's rights are resolved, or that
 * the line was removed. The line remains in the product and the identity remains
 * UNRESOLVED. The claim is only that this particular surviving text is below the
 * threshold at which authorship could be asserted over it.
 */

export const SUPPORTED_DETERMINATIONS = ['NON_EXPRESSIVE_CI_TRIGGER_RESIDUE'];

/** Characters that indicate executable content rather than prose. */
const CODE_BEARING = /[$`(){}[\];=|&<>*\\]/;
const COMMENT_PREFIX = /^\s*(#|\/\/|--)\s?/;

/** A comment long enough to plausibly express something is not de minimis. */
const MAX_COMMENT_CHARS = 80;
const MAX_COMMENT_WORDS = 10;

/**
 * Decide whether a single line of surviving text carries expression.
 * Returns null when the line is non-expressive, or a reason string when it is.
 */
export function expressionIn(content) {
  const raw = String(content ?? '');
  if (raw.trim() === '') return null;

  const prefixMatch = COMMENT_PREFIX.exec(raw);
  if (!prefixMatch) return 'line is not blank and not a comment';

  const body = raw.slice(prefixMatch[0].length).trim();
  if (body === '') return null;

  if (CODE_BEARING.test(body)) return 'comment body contains code-bearing characters';
  if (body.length > MAX_COMMENT_CHARS) {
    return `comment body is ${body.length} chars, over the ${MAX_COMMENT_CHARS} char de minimis ceiling`;
  }
  const words = body.split(/\s+/).filter(Boolean);
  if (words.length > MAX_COMMENT_WORDS) {
    return `comment body is ${words.length} words, over the ${MAX_COMMENT_WORDS} word de minimis ceiling`;
  }
  return null;
}

export function parseDeminimisRegister(raw) {
  const defects = [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { adjudications: [], defects: [`register is not valid JSON: ${error.message}`] };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { adjudications: [], defects: ['register is not an object'] };
  }
  if (parsed.schemaVersion !== 1) {
    defects.push(`unsupported schemaVersion ${JSON.stringify(parsed.schemaVersion)}`);
  }
  const entries = Array.isArray(parsed.adjudications) ? parsed.adjudications : null;
  if (!entries) {
    defects.push('register has no adjudications array');
    return { adjudications: [], defects };
  }

  const adjudications = [];
  const seen = new Set();
  entries.forEach((entry, index) => {
    const at = `adjudications[${index}]`;
    const path = typeof entry?.path === 'string' ? entry.path.trim() : '';
    const email = typeof entry?.identityEmail === 'string'
      ? entry.identityEmail.trim().toLowerCase()
      : '';
    if (!path) defects.push(`${at} has no path`);
    if (!email) defects.push(`${at} has no identityEmail`);
    if (!SUPPORTED_DETERMINATIONS.includes(entry?.determination)) {
      defects.push(`${at} has unsupported determination ${JSON.stringify(entry?.determination)}`);
    }
    if (typeof entry?.rationale !== 'string' || entry.rationale.trim().length < 20) {
      defects.push(`${at} has no substantive rationale`);
    }
    const lines = Array.isArray(entry?.lines) ? entry.lines : null;
    if (!lines || lines.length === 0) {
      defects.push(`${at} quotes no lines`);
    } else {
      lines.forEach((line, lineIndex) => {
        if (!Number.isInteger(line?.line) || line.line < 1) {
          defects.push(`${at}.lines[${lineIndex}] has no valid line number`);
        }
        if (typeof line?.content !== 'string') {
          defects.push(`${at}.lines[${lineIndex}] does not quote its content`);
        }
      });
    }
    const key = `${path}\u0000${email}`;
    if (seen.has(key)) defects.push(`${at} duplicates an earlier adjudication for the same file and identity`);
    seen.add(key);

    if (path && email && lines) {
      adjudications.push({
        path,
        identityEmail: email,
        determination: entry.determination,
        rationale: String(entry.rationale ?? ''),
        originCommit: typeof entry.originCommit === 'string' ? entry.originCommit : '',
        lines: lines.map((line) => ({ line: line.line, content: String(line.content ?? '') })),
      });
    }
  });

  return { adjudications, defects };
}

/**
 * Verify one adjudication against the surviving lines actually attributed to the
 * identity in the current tree.
 *
 * @param {{lines: Array<{line: number, content: string}>}} adjudication
 * @param {Array<{line: number, content: string}>} survivingLines the real ones
 * @returns {{ok: boolean, reason: string}}
 */
export function verifyDeminimis(adjudication, survivingLines) {
  const actual = Array.isArray(survivingLines) ? survivingLines : [];
  if (actual.length === 0) {
    return { ok: false, reason: 'no surviving lines attributed to this identity in this file; adjudication is stale' };
  }

  const quoted = new Map(adjudication.lines.map((entry) => [entry.line, entry.content]));
  for (const entry of actual) {
    if (!quoted.has(entry.line)) {
      return { ok: false, reason: `line ${entry.line} survives but is not quoted in the adjudication` };
    }
    if (quoted.get(entry.line) !== entry.content) {
      return { ok: false, reason: `line ${entry.line} has changed since it was adjudicated` };
    }
  }
  for (const line of quoted.keys()) {
    if (!actual.some((entry) => entry.line === line)) {
      return { ok: false, reason: `adjudication quotes line ${line}, which is no longer attributed to this identity` };
    }
  }

  for (const entry of actual) {
    const expression = expressionIn(entry.content);
    if (expression) {
      return { ok: false, reason: `line ${entry.line} is not de minimis: ${expression}` };
    }
  }

  return { ok: true, reason: `${actual.length} surviving line(s) carry no expression` };
}
