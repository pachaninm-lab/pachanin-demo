// Adjudication of offline similarity findings.
//
// A screening match is not by itself evidence of copying. A re-export barrel
// normalizes to the token set {export, *, from, <STRING>, ;}: normalization
// replaces every string literal with <STRING>, so the module paths - the only
// content that distinguishes one barrel from another - are erased before
// comparison. What matches is the idiom skeleton, which carries no protectable
// expression in either direction.
//
// Excluding such files from the scan would be the wrong fix: a real copy could
// then hide inside a barrel-shaped wrapper. They stay fingerprinted, the finding
// is still recorded, and what an adjudication changes is only whether the finding
// counts as unresolved.
//
// An adjudication is never taken on trust. Every determination is re-verified
// from the file's current content on each run, using the SAME tokenizer the
// matcher uses, so the verifier cannot drift into a second opinion. Adding one
// line of real logic to an adjudicated file makes the determination stop holding.

export const RE_EXPORT_IDIOM_TOKENS = Object.freeze(['*', ';', '<STRING>', 'export', 'from']);
export const SUPPORTED_DETERMINATIONS = Object.freeze(['RE_EXPORT_BARREL_NO_EXPRESSION']);
export const SUPPORTED_SCOPES = Object.freeze(['ALL_MATCHES_FOR_SOURCE']);
export const MINIMUM_RATIONALE_LENGTH = 40;

export function normalizeSource(source) {
  return source
    .replace(/\r\n?/gu, '\n')
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/gu, '$1 ')
    .replace(/(['"`])(?:\\.|(?!\1)[\s\S])*\1/gu, '<STRING>')
    .replace(/\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b/giu, '<NUMBER>')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function tokens(source) {
  return normalizeSource(source).match(/[\p{L}_$][\p{L}\p{N}_$]*|<STRING>|<NUMBER>|===|!==|=>|==|!=|<=|>=|&&|\|\||[^\s]/gu) ?? [];
}

export function parseAdjudications(document, now = Date.now()) {
  const adjudications = new Map();
  const defects = [];
  if (document === null || typeof document !== 'object') {
    return { adjudications, defects: ['DOCUMENT_NOT_AN_OBJECT'] };
  }
  if (document.schemaVersion !== 1) {
    return { adjudications, defects: ['UNSUPPORTED_SCHEMA_VERSION'] };
  }
  const entries = Array.isArray(document.adjudications) ? document.adjudications : [];
  for (const entry of entries) {
    const sourcePath = typeof entry?.sourcePath === 'string' ? entry.sourcePath.trim() : '';
    if (!sourcePath) { defects.push('MISSING_SOURCE_PATH'); continue; }
    if (adjudications.has(sourcePath)) { defects.push(`DUPLICATE:${sourcePath}`); continue; }
    if (!SUPPORTED_DETERMINATIONS.includes(entry?.determination)) {
      defects.push(`UNSUPPORTED_DETERMINATION:${sourcePath}`); continue;
    }
    if (!SUPPORTED_SCOPES.includes(entry?.scope)) {
      defects.push(`UNSUPPORTED_SCOPE:${sourcePath}`); continue;
    }
    if (String(entry?.rationale ?? '').trim().length < MINIMUM_RATIONALE_LENGTH) {
      defects.push(`RATIONALE_TOO_SHORT:${sourcePath}`); continue;
    }
    const reviewedAt = String(entry?.reviewedAt ?? '');
    const reviewedAtTime = /^\d{4}-\d{2}-\d{2}$/u.test(reviewedAt) ? Date.parse(`${reviewedAt}T00:00:00Z`) : Number.NaN;
    if (!Number.isFinite(reviewedAtTime)
      || reviewedAtTime > now
      || new Date(reviewedAtTime).toISOString().slice(0, 10) !== reviewedAt) {
      defects.push(`INVALID_REVIEWED_AT:${sourcePath}`); continue;
    }
    adjudications.set(sourcePath, entry);
  }
  return { adjudications, defects };
}

// A byte-identical file is never adjudicable: no idiom argument explains it away.
export function verifyAdjudication(entry, sourceText, method) {
  if (!entry) return null;
  if (method === 'EXACT_SHA256') {
    return { resolved: false, decision: 'ADJUDICATION_REFUSED_FOR_EXACT_MATCH', evidence: 'The file is byte-identical to a corpus file; no idiom determination can resolve an exact match.' };
  }
  if (entry.determination === 'RE_EXPORT_BARREL_NO_EXPRESSION') {
    const distinct = [...new Set(tokens(sourceText))].sort();
    const foreign = distinct.filter((token) => !RE_EXPORT_IDIOM_TOKENS.includes(token));
    if (foreign.length) {
      return { resolved: false, decision: 'ADJUDICATION_NO_LONGER_HOLDS', evidence: `Re-verified now: the file carries non-idiom tokens ${JSON.stringify(foreign.slice(0, 6))}, so the recorded determination does not describe its current content.` };
    }
    if (!distinct.length) {
      return { resolved: false, decision: 'ADJUDICATION_NO_LONGER_HOLDS', evidence: 'Re-verified now: the file has no tokens at all, which the determination does not cover.' };
    }
    return { resolved: true, decision: 'RESOLVED_RE_EXPORT_BARREL_NO_EXPRESSION', evidence: `Re-verified now: the normalized token set ${JSON.stringify(distinct)} lies within the re-export idiom; module paths are erased by normalization, so the match carries no protectable expression.` };
  }
  return { resolved: false, decision: 'ADJUDICATION_NOT_VERIFIABLE', evidence: 'No verifier is implemented for this determination.' };
}
