/**
 * Pure decisions behind the Rospatent deposit package, separated so they can be
 * exercised directly rather than by reading a 70-page listing.
 *
 * Two things in that build are worth testing on their own: whether the package may
 * be described as filing-ready, and how the listing is abridged to fit the page
 * limit. Both are places where a quiet mistake would be costly -- the first would
 * put a false authorship declaration on a state register, the second would deposit
 * material that misrepresents what the program contains.
 */

/**
 * Decide whether a deposit may be called filing-ready.
 *
 * Filing-ready requires that every deposited file carries evidenced first-party
 * origin AT THE COMMIT BEING DEPOSITED. Evidence generated at a different commit
 * describes different code and does not transfer, so a head mismatch blocks rather
 * than being tolerated.
 *
 * @param {{gitHead: string, records: Array<{path: string, origin_class: string}>}|null} provenance
 * @param {string[]} coveredPaths files that will appear in the listing
 * @param {string} head the commit being deposited
 */
export function computeFilingReadiness(provenance, coveredPaths, head) {
  if (!provenance || !Array.isArray(provenance.records)) {
    return {
      filingReadiness: 'UNKNOWN_PROVENANCE_EVIDENCE_MISSING',
      filingBlockers: ['FILE_PROVENANCE.json not found; run scripts/ip/build-ip-clean-room.mjs first'],
    };
  }
  if (provenance.gitHead !== head) {
    return {
      filingReadiness: 'BLOCKED',
      filingBlockers: [`provenance evidence is for ${provenance.gitHead}, deposit is for ${head}`],
    };
  }
  const byPath = new Map(provenance.records.map((record) => [record.path, record]));
  const unresolved = coveredPaths.filter((path) => {
    const record = byPath.get(path);
    return !record || record.origin_class === 'UNKNOWN';
  });
  if (unresolved.length > 0) {
    return {
      filingReadiness: 'BLOCKED',
      filingBlockers: [`UNRESOLVED_ORIGIN_IN_DEPOSITED_MATERIAL:${unresolved.length}`],
      unresolved,
    };
  }
  return { filingReadiness: 'READY_FOR_LEGAL_REVIEW', filingBlockers: [] };
}

/**
 * Abridge a listing to fit the page allowance, keeping the head and the tail and
 * declaring the omission in between.
 *
 * The omission notice is part of the deposited material and counts against the
 * allowance, so the result never exceeds availableLines.
 */
export function abridgeListing(bodyLines, availableLines, noticeFor) {
  if (bodyLines.length <= availableLines) {
    return { lines: bodyLines, abridged: false, omittedLines: 0 };
  }
  const notice = noticeFor(0);
  const keep = availableLines - notice.length;
  if (keep < 2) throw new Error('page allowance too small to abridge');
  const headLines = Math.ceil(keep / 2);
  const tailLines = keep - headLines;
  const omittedLines = bodyLines.length - keep;
  return {
    lines: [...bodyLines.slice(0, headLines), ...noticeFor(omittedLines), ...bodyLines.slice(-tailLines)],
    abridged: true,
    omittedLines,
  };
}
