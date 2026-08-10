/**
 * What "the answer is about the right subject" means, precisely enough to test.
 *
 * The live matrix asserts things about conversation state — a follow-up
 * resolved against the active subject, a correction that took, a topic shift
 * that did not blend. Those assertions have to survive a model that rephrases
 * freely, so they are bounded term checks rather than prose matching, and they
 * live here so they can be exercised without a browser or production.
 */

/** Terms from `terms` that appear in `answer`, case- and form-insensitively. */
export function matchedTerms(answer, terms) {
  const normalized = String(answer).normalize('NFKC').toLowerCase();
  return terms.filter(term => normalized.includes(term.toLowerCase()));
}

export function countOccurrences(answer, terms) {
  const normalized = String(answer).normalize('NFKC').toLowerCase();
  let total = 0;
  for (const term of terms) {
    const needle = term.toLowerCase();
    let from = 0;
    for (;;) {
      const at = normalized.indexOf(needle, from);
      if (at < 0) break;
      total += 1;
      from = at + needle.length;
    }
  }
  return total;
}

export function requireSubject({ id, answer, expect: expected, minimum = 1 }) {
  const hits = matchedTerms(answer, expected);
  if (hits.length < minimum) throw new Error(`ui_subject_missing:${id}:${expected.join(',')}`);
  return hits;
}

/**
 * The current subject must lead the answer, not merely appear in it.
 *
 * Forbidding the superseded subject outright reads well and fails badly: a
 * model that correctly says "not wheat any more \u2014 for potato, do X" names
 * both, and an absolute prohibition would call that a regression. What actually
 * distinguishes a correction that took from one that did not is which subject
 * the answer is *about*, so the current subject must be present and must not be
 * outweighed by the one it replaced.
 */
export function requireSubjectDominance({ id, answer, current, superseded, minimumCurrent = 1 }) {
  const currentHits = matchedTerms(answer, current);
  if (currentHits.length < minimumCurrent) {
    throw new Error(`ui_current_subject_missing:${id}:${current.join(',')}`);
  }
  const currentCount = countOccurrences(answer, current);
  const supersededCount = countOccurrences(answer, superseded);
  if (supersededCount >= currentCount) {
    throw new Error(`ui_superseded_subject_dominant:${id}:${supersededCount}:${currentCount}`);
  }
  return Object.freeze({ currentHits, currentCount, supersededCount });
}
