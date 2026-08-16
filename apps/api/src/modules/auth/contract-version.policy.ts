/**
 * Which version of the commercial terms a document was generated under.
 *
 * The third revision source the staleness snapshot records: `CONTRACT_VERSION`.
 * A УПД states a price, a delivery basis and a payment term, and every one of
 * those comes from an agreement that can be amended. When it is amended, the
 * document does not become wrong — it becomes a description of terms that no
 * longer apply, which is a different and quieter problem. Recording the exact
 * version it drew from is what lets the platform say which.
 *
 * A signed contract version is immutable in the same way a signed document
 * version is, and for the same reason: the signature is evidence of what was
 * agreed, and terms that can move underneath it are not evidence of anything.
 * An amendment is a new version that supersedes the old one; the old one stays.
 */

export const ContractVersionStatus = {
  DRAFT: 'DRAFT',
  SIGNED: 'SIGNED',
  /** Replaced by a later version. Still evidence of what applied before. */
  SUPERSEDED: 'SUPERSEDED',
  /** Ended early. Distinct from superseded: nothing replaced it. */
  TERMINATED: 'TERMINATED',
} as const;

export type ContractVersionStatus =
  typeof ContractVersionStatus[keyof typeof ContractVersionStatus];

export type ContractVersion = {
  contractNumber: string;
  versionNumber: number;
  status: ContractVersionStatus;
  /** SHA-256 of the exact terms this version fixes. */
  termsHash: string;
  effectiveFrom: Date;
  /** Exclusive. Null means still in force. */
  effectiveTo: Date | null;
  signedAt: Date | null;
  /** The version this one replaces; null only for the first. */
  supersedesVersionNumber: number | null;
};

export const ContractResolutionFailure = {
  NO_VERSION_IN_FORCE: 'NO_VERSION_IN_FORCE',
  AMBIGUOUS_VERSIONS: 'AMBIGUOUS_VERSIONS',
  ONLY_UNSIGNED_VERSIONS: 'ONLY_UNSIGNED_VERSIONS',
} as const;

export type ContractResolutionFailure =
  typeof ContractResolutionFailure[keyof typeof ContractResolutionFailure];

export type ContractResolution =
  | { resolved: true; version: ContractVersion; revision: string }
  | {
      resolved: false;
      failure: ContractResolutionFailure;
      candidates: readonly string[];
    };

/** The revision a document version records for CONTRACT_VERSION. */
export function contractVersionRevision(version: {
  contractNumber: string;
  versionNumber: number;
}): string {
  return `${version.contractNumber}#${version.versionNumber}`;
}

function inWindow(version: ContractVersion, at: Date): boolean {
  if (at.getTime() < version.effectiveFrom.getTime()) {
    return false;
  }
  return (
    version.effectiveTo === null || at.getTime() < version.effectiveTo.getTime()
  );
}

/**
 * Which version governed a document produced at `at`.
 *
 * Only signed versions govern anything. A draft amendment sitting alongside a
 * signed version is a proposal, and generating a document under a proposal
 * would state terms nobody agreed to — so an unsigned version in the window is
 * reported as such rather than silently ignored, which would otherwise look
 * identical to no contract at all.
 */
export function resolveContractVersion(
  versions: readonly ContractVersion[],
  contractNumber: string,
  at: Date,
): ContractResolution {
  const inContract = versions.filter(
    (version) => version.contractNumber === contractNumber,
  );
  const windowed = inContract.filter((version) => inWindow(version, at));
  const governing = windowed.filter(
    (version) =>
      version.status === ContractVersionStatus.SIGNED &&
      version.signedAt !== null,
  );

  if (governing.length === 1) {
    return {
      resolved: true,
      version: governing[0],
      revision: contractVersionRevision(governing[0]),
    };
  }

  if (governing.length > 1) {
    return {
      resolved: false,
      failure: ContractResolutionFailure.AMBIGUOUS_VERSIONS,
      candidates: governing.map(contractVersionRevision),
    };
  }

  if (windowed.length > 0) {
    return {
      resolved: false,
      failure: ContractResolutionFailure.ONLY_UNSIGNED_VERSIONS,
      candidates: windowed.map(contractVersionRevision),
    };
  }

  return {
    resolved: false,
    failure: ContractResolutionFailure.NO_VERSION_IN_FORCE,
    candidates: [],
  };
}

export const ContractVersionDenyReason = {
  BLANK_CONTRACT_NUMBER: 'BLANK_CONTRACT_NUMBER',
  BLANK_TERMS_HASH: 'BLANK_TERMS_HASH',
  NON_POSITIVE_VERSION: 'NON_POSITIVE_VERSION',
  INVERTED_WINDOW: 'INVERTED_WINDOW',
  DUPLICATE_VERSION_NUMBER: 'DUPLICATE_VERSION_NUMBER',
  VERSION_NOT_SEQUENTIAL: 'VERSION_NOT_SEQUENTIAL',
  MISSING_SUPERSEDED_REFERENCE: 'MISSING_SUPERSEDED_REFERENCE',
  SUPERSEDED_REFERENCE_ON_FIRST: 'SUPERSEDED_REFERENCE_ON_FIRST',
  SUPERSEDES_UNKNOWN_VERSION: 'SUPERSEDES_UNKNOWN_VERSION',
  SUPERSEDES_UNSIGNED_VERSION: 'SUPERSEDES_UNSIGNED_VERSION',
  OVERLAPS_SIGNED_VERSION: 'OVERLAPS_SIGNED_VERSION',
  SIGNED_WITHOUT_TIMESTAMP: 'SIGNED_WITHOUT_TIMESTAMP',
  UNSIGNED_WITH_TIMESTAMP: 'UNSIGNED_WITH_TIMESTAMP',
} as const;

export type ContractVersionDenyReason =
  typeof ContractVersionDenyReason[keyof typeof ContractVersionDenyReason];

/**
 * May this version be recorded against the contract?
 *
 * The sequencing rules exist because a contract's version numbers are cited in
 * documents and in correspondence. A gap or a reused number makes "amendment 3"
 * ambiguous, and an amendment that names no predecessor leaves no chain to
 * follow back to what was originally agreed.
 */
export function evaluateContractVersionPublication(input: {
  candidate: ContractVersion;
  existing: readonly ContractVersion[];
}): { allowed: boolean; reasons: readonly ContractVersionDenyReason[] } {
  const { candidate } = input;
  const reasons: ContractVersionDenyReason[] = [];
  const siblings = input.existing.filter(
    (version) => version.contractNumber === candidate.contractNumber,
  );

  if (candidate.contractNumber.trim().length === 0) {
    reasons.push(ContractVersionDenyReason.BLANK_CONTRACT_NUMBER);
  }
  if (candidate.termsHash.trim().length === 0) {
    reasons.push(ContractVersionDenyReason.BLANK_TERMS_HASH);
  }
  if (!Number.isInteger(candidate.versionNumber) || candidate.versionNumber < 1) {
    reasons.push(ContractVersionDenyReason.NON_POSITIVE_VERSION);
  }
  if (
    candidate.effectiveTo !== null &&
    candidate.effectiveTo.getTime() <= candidate.effectiveFrom.getTime()
  ) {
    reasons.push(ContractVersionDenyReason.INVERTED_WINDOW);
  }

  // A status and a timestamp that disagree produce a version that reads as
  // signed to one check and unsigned to another.
  if (
    candidate.status === ContractVersionStatus.SIGNED &&
    candidate.signedAt === null
  ) {
    reasons.push(ContractVersionDenyReason.SIGNED_WITHOUT_TIMESTAMP);
  }
  if (
    candidate.status === ContractVersionStatus.DRAFT &&
    candidate.signedAt !== null
  ) {
    reasons.push(ContractVersionDenyReason.UNSIGNED_WITH_TIMESTAMP);
  }

  if (
    siblings.some(
      (version) => version.versionNumber === candidate.versionNumber,
    )
  ) {
    reasons.push(ContractVersionDenyReason.DUPLICATE_VERSION_NUMBER);
  }

  const highest = siblings.reduce(
    (max, version) => Math.max(max, version.versionNumber),
    0,
  );
  if (candidate.versionNumber !== highest + 1) {
    reasons.push(ContractVersionDenyReason.VERSION_NOT_SEQUENTIAL);
  }

  if (candidate.versionNumber === 1) {
    if (candidate.supersedesVersionNumber !== null) {
      reasons.push(ContractVersionDenyReason.SUPERSEDED_REFERENCE_ON_FIRST);
    }
  } else if (candidate.supersedesVersionNumber === null) {
    reasons.push(ContractVersionDenyReason.MISSING_SUPERSEDED_REFERENCE);
  } else {
    const predecessor = siblings.find(
      (version) => version.versionNumber === candidate.supersedesVersionNumber,
    );
    if (predecessor === undefined) {
      reasons.push(ContractVersionDenyReason.SUPERSEDES_UNKNOWN_VERSION);
    } else if (predecessor.signedAt === null) {
      // Replacing a draft is editing it, not amending an agreement. Allowing
      // it would let an unsigned proposal acquire a chain of amendments and
      // look like a history that was never agreed.
      reasons.push(ContractVersionDenyReason.SUPERSEDES_UNSIGNED_VERSION);
    }
  }

  if (
    candidate.status === ContractVersionStatus.SIGNED &&
    siblings.some((version) => {
      if (version.versionNumber === candidate.versionNumber) {
        return false;
      }
      if (version.status !== ContractVersionStatus.SIGNED) {
        return false;
      }
      const end = version.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
      const candidateEnd =
        candidate.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
      return (
        version.effectiveFrom.getTime() < candidateEnd &&
        candidate.effectiveFrom.getTime() < end
      );
    })
  ) {
    reasons.push(ContractVersionDenyReason.OVERLAPS_SIGNED_VERSION);
  }

  return { allowed: reasons.length === 0, reasons };
}
