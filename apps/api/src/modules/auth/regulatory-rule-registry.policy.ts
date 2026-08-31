/**
 * Which version of a rule applied when a document was produced.
 *
 * The staleness snapshot already records a REGULATORY_RULE revision for every
 * accounting document version, and until now nothing produced one. This is the
 * registry behind it: a rule — the VAT rate list, the УПД format, whatever a
 * ministry publishes and later replaces — stored as a sequence of versions with
 * effective windows, rather than as a constant in the code.
 *
 * The reason it cannot be a constant is that documents outlive rules. A УПД
 * issued in March under one rate list must keep describing itself under that
 * list when it is re-read in November, and a platform that hardcodes the
 * current rate silently rewrites its own history the day the rate changes. The
 * revision recorded on the version is what makes that impossible; this makes
 * the revision mean something.
 *
 * The registry is deliberately platform-wide rather than per-tenant. Tax law is
 * not an organization's setting, and a rule table a tenant could write is a
 * rule table a tenant could rewrite to justify a document after the fact. The
 * accompanying migration grants the accounting principals SELECT and nothing
 * else on it.
 */

export const RuleStatus = {
  ACTIVE: 'ACTIVE',
  /** Published but not yet in force, or withdrawn. Never resolved. */
  SUPERSEDED: 'SUPERSEDED',
} as const;

export type RuleStatus = typeof RuleStatus[keyof typeof RuleStatus];

export type RuleVersion = {
  ruleKey: string;
  versionTag: string;
  effectiveFrom: Date;
  /** Exclusive. Null means still in force. */
  effectiveTo: Date | null;
  status: RuleStatus;
  /** Legal citation, so a document can say why it looks the way it does. */
  source: string;
  payload: Readonly<Record<string, unknown>>;
};

export const RuleResolutionFailure = {
  NO_VERSION_IN_FORCE: 'NO_VERSION_IN_FORCE',
  AMBIGUOUS_VERSIONS: 'AMBIGUOUS_VERSIONS',
} as const;

export type RuleResolutionFailure =
  typeof RuleResolutionFailure[keyof typeof RuleResolutionFailure];

export type RuleResolution =
  | { resolved: true; version: RuleVersion; revision: string }
  | { resolved: false; failure: RuleResolutionFailure; candidates: readonly string[] };

/**
 * The revision string a document version records.
 *
 * Key and tag together, because a bare tag collides across rules — two
 * ministries both publishing a `2026-01` would otherwise be indistinguishable
 * in a snapshot.
 */
export function ruleRevision(version: {
  ruleKey: string;
  versionTag: string;
}): string {
  return `${version.ruleKey}@${version.versionTag}`;
}

function inForce(version: RuleVersion, at: Date): boolean {
  if (version.status !== RuleStatus.ACTIVE) {
    return false;
  }
  if (at.getTime() < version.effectiveFrom.getTime()) {
    return false;
  }
  // Exclusive end bound: a version that ends at midnight does not also apply at
  // midnight, which is when its successor begins. Overlapping by one instant is
  // how two rates end up both applying to the same document.
  return version.effectiveTo === null || at.getTime() < version.effectiveTo.getTime();
}

/**
 * Which version of `ruleKey` governed a document produced at `at`.
 *
 * Ambiguity is reported, never broken by picking the newest. Two versions in
 * force at once is a registry error, and quietly choosing one would produce a
 * document that is defensible only until somebody asks which rule it followed.
 * The database refuses to store the overlap; this refuses to paper over one
 * that reached memory anyway.
 */
export function resolveRuleVersion(
  versions: readonly RuleVersion[],
  ruleKey: string,
  at: Date,
): RuleResolution {
  const matches = versions.filter(
    (version) => version.ruleKey === ruleKey && inForce(version, at),
  );

  if (matches.length === 1) {
    return {
      resolved: true,
      version: matches[0],
      revision: ruleRevision(matches[0]),
    };
  }

  if (matches.length === 0) {
    return {
      resolved: false,
      failure: RuleResolutionFailure.NO_VERSION_IN_FORCE,
      candidates: [],
    };
  }

  return {
    resolved: false,
    failure: RuleResolutionFailure.AMBIGUOUS_VERSIONS,
    candidates: matches.map(ruleRevision),
  };
}

export const RuleVersionDenyReason = {
  BLANK_RULE_KEY: 'BLANK_RULE_KEY',
  BLANK_VERSION_TAG: 'BLANK_VERSION_TAG',
  BLANK_SOURCE: 'BLANK_SOURCE',
  INVERTED_WINDOW: 'INVERTED_WINDOW',
  OVERLAPS_EXISTING_VERSION: 'OVERLAPS_EXISTING_VERSION',
  DUPLICATE_VERSION_TAG: 'DUPLICATE_VERSION_TAG',
  PAYLOAD_NOT_OBJECT: 'PAYLOAD_NOT_OBJECT',
} as const;

export type RuleVersionDenyReason =
  typeof RuleVersionDenyReason[keyof typeof RuleVersionDenyReason];

export type RuleVersionDecision = {
  allowed: boolean;
  reasons: readonly RuleVersionDenyReason[];
};

function windowsOverlap(a: RuleVersion, b: RuleVersion): boolean {
  const aEnd = a.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  const bEnd = b.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  return a.effectiveFrom.getTime() < bEnd && b.effectiveFrom.getTime() < aEnd;
}

/**
 * May this version be published?
 *
 * Only ACTIVE versions are checked for overlap. A superseded one is history —
 * it describes a window that has already been re-legislated, and refusing to
 * store it would lose the record of what a document issued then was following.
 */
export function evaluateRuleVersionPublication(input: {
  candidate: RuleVersion;
  existing: readonly RuleVersion[];
}): RuleVersionDecision {
  const { candidate, existing } = input;
  const reasons: RuleVersionDenyReason[] = [];

  if (candidate.ruleKey.trim().length === 0) {
    reasons.push(RuleVersionDenyReason.BLANK_RULE_KEY);
  }
  if (candidate.versionTag.trim().length === 0) {
    reasons.push(RuleVersionDenyReason.BLANK_VERSION_TAG);
  }
  // A rule with no citation cannot be audited, only trusted.
  if (candidate.source.trim().length === 0) {
    reasons.push(RuleVersionDenyReason.BLANK_SOURCE);
  }
  if (
    candidate.payload === null ||
    typeof candidate.payload !== 'object' ||
    Array.isArray(candidate.payload)
  ) {
    reasons.push(RuleVersionDenyReason.PAYLOAD_NOT_OBJECT);
  }
  if (
    candidate.effectiveTo !== null &&
    candidate.effectiveTo.getTime() <= candidate.effectiveFrom.getTime()
  ) {
    reasons.push(RuleVersionDenyReason.INVERTED_WINDOW);
  }

  const sameKey = existing.filter(
    (version) => version.ruleKey === candidate.ruleKey,
  );

  if (sameKey.some((version) => version.versionTag === candidate.versionTag)) {
    reasons.push(RuleVersionDenyReason.DUPLICATE_VERSION_TAG);
  }

  if (
    candidate.status === RuleStatus.ACTIVE &&
    sameKey.some(
      (version) =>
        version.status === RuleStatus.ACTIVE &&
        version.versionTag !== candidate.versionTag &&
        windowsOverlap(version, candidate),
    )
  ) {
    reasons.push(RuleVersionDenyReason.OVERLAPS_EXISTING_VERSION);
  }

  return { allowed: reasons.length === 0, reasons };
}
