/**
 * What an organization's tax status permits a document to say.
 *
 * This is the second revision source the staleness snapshot records and
 * nothing produced: `TAX_PROFILE`. Like the regulatory registry, the profile is
 * a sequence of versions with effective windows, because a regime change in
 * July must not retroactively change what a document issued in March says
 * about itself.
 *
 * What this deliberately does not do is decide tax law. It holds no rate table
 * and no list of exemptions; the rates come from a version of the VAT_RATES
 * rule resolved through the registry, which cites its legal source. What it
 * enforces is consistency between three things that must agree — the
 * organization's declared status, the rule in force, and what the document
 * actually claims. A platform that inferred the correct VAT treatment itself
 * would be quietly practising accountancy on the user's behalf, and would be
 * wrong the first time a rule changed without the code changing.
 *
 * Money is `bigint` kopecks throughout. `packages/domain-core/src/money.ts`
 * forbids `number` arithmetic on money, and a VAT amount is exactly the kind of
 * value that a float turns into a rounding dispute.
 */

export const TaxRegime = {
  /** Общая система налогообложения. */
  OSNO: 'OSNO',
  /** Упрощённая. */
  USN: 'USN',
  /** Единый сельскохозяйственный налог — the common one in grain. */
  ESHN: 'ESHN',
} as const;

export type TaxRegime = typeof TaxRegime[keyof typeof TaxRegime];

export const VatStatus = {
  PAYER: 'PAYER',
  /**
   * Registered for VAT but exempt under a stated ground. Kept distinct from
   * NOT_PAYER because the document must say which it is: an exempt payer
   * states a ground, a non-payer states none, and conflating them produces a
   * document that cannot be checked.
   */
  EXEMPT: 'EXEMPT',
  NOT_PAYER: 'NOT_PAYER',
} as const;

export type VatStatus = typeof VatStatus[keyof typeof VatStatus];

export type TaxProfileVersion = {
  organizationId: string;
  versionTag: string;
  taxRegime: TaxRegime;
  vatStatus: VatStatus;
  /** Required whenever the status is EXEMPT; the legal ground, in words. */
  vatExemptionGround: string | null;
  effectiveFrom: Date;
  /** Exclusive. Null means still current. */
  effectiveTo: Date | null;
};

export const TaxProfileResolutionFailure = {
  NO_PROFILE_IN_FORCE: 'NO_PROFILE_IN_FORCE',
  AMBIGUOUS_PROFILES: 'AMBIGUOUS_PROFILES',
} as const;

export type TaxProfileResolutionFailure =
  typeof TaxProfileResolutionFailure[keyof typeof TaxProfileResolutionFailure];

export type TaxProfileResolution =
  | { resolved: true; profile: TaxProfileVersion; revision: string }
  | {
      resolved: false;
      failure: TaxProfileResolutionFailure;
      candidates: readonly string[];
    };

/** The revision a document version records for TAX_PROFILE. */
export function taxProfileRevision(profile: {
  organizationId: string;
  versionTag: string;
}): string {
  return `${profile.organizationId}@${profile.versionTag}`;
}

function inForce(profile: TaxProfileVersion, at: Date): boolean {
  if (at.getTime() < profile.effectiveFrom.getTime()) {
    return false;
  }
  return (
    profile.effectiveTo === null || at.getTime() < profile.effectiveTo.getTime()
  );
}

/**
 * Which tax profile governed a document produced at `at`.
 *
 * Ambiguity is reported rather than resolved by taking the newest, for the same
 * reason as in the rule registry: a document generated under a status the
 * platform picked is defensible only until somebody asks which status applied.
 */
export function resolveTaxProfile(
  profiles: readonly TaxProfileVersion[],
  organizationId: string,
  at: Date,
): TaxProfileResolution {
  const matches = profiles.filter(
    (profile) =>
      profile.organizationId === organizationId && inForce(profile, at),
  );

  if (matches.length === 1) {
    return {
      resolved: true,
      profile: matches[0],
      revision: taxProfileRevision(matches[0]),
    };
  }
  if (matches.length === 0) {
    return {
      resolved: false,
      failure: TaxProfileResolutionFailure.NO_PROFILE_IN_FORCE,
      candidates: [],
    };
  }
  return {
    resolved: false,
    failure: TaxProfileResolutionFailure.AMBIGUOUS_PROFILES,
    candidates: matches.map(taxProfileRevision),
  };
}

export const TaxTreatmentDenyReason = {
  NO_TAX_PROFILE: 'NO_TAX_PROFILE',
  MISSING_EXEMPTION_GROUND: 'MISSING_EXEMPTION_GROUND',
  /** A non-payer or an exempt organization charging VAT. */
  VAT_CHARGED_WITHOUT_STATUS: 'VAT_CHARGED_WITHOUT_STATUS',
  /** A payer issuing a taxable document with no VAT stated at all. */
  VAT_MISSING_FOR_PAYER: 'VAT_MISSING_FOR_PAYER',
  /** A rate the rule version in force does not list. */
  RATE_NOT_IN_FORCE: 'RATE_NOT_IN_FORCE',
  /** A rate stated by an organization that does not charge VAT. */
  RATE_STATED_WITHOUT_STATUS: 'RATE_STATED_WITHOUT_STATUS',
  EXEMPTION_GROUND_ON_NON_EXEMPT: 'EXEMPTION_GROUND_ON_NON_EXEMPT',
  NEGATIVE_VAT_ON_POSITIVE_BASE: 'NEGATIVE_VAT_ON_POSITIVE_BASE',
  RULE_VERSION_MISSING: 'RULE_VERSION_MISSING',
} as const;

export type TaxTreatmentDenyReason =
  typeof TaxTreatmentDenyReason[keyof typeof TaxTreatmentDenyReason];

export type TaxTreatmentDecision = {
  allowed: boolean;
  reasons: readonly TaxTreatmentDenyReason[];
  /** What the document must print where the VAT line goes. */
  vatLine: string | null;
};

/**
 * Does what this document claims about VAT agree with who is issuing it and
 * with the rule in force?
 *
 * `ratesInForce` comes from the resolved VAT_RATES rule version — the caller
 * passes what the registry returned rather than a constant, so a rate that
 * stopped being lawful stops being acceptable without this file changing.
 * An empty list means no rate is currently lawful and is treated as such,
 * never as "any rate is fine": the same reading that makes an empty
 * allowed-document-type list mean nothing rather than everything.
 */
export function evaluateDocumentTaxTreatment(input: {
  profile: TaxProfileVersion | null;
  /** Rate codes the rule version lists, e.g. ['10', '20']. */
  ratesInForce: readonly string[] | null;
  /** The rate the document states, or null when it states none. */
  statedRate: string | null;
  /** Kopecks. Null when the document states no VAT amount. */
  vatAmountKopecks: bigint | null;
  /** Kopecks, the amount VAT would be charged on. */
  taxableBaseKopecks: bigint;
}): TaxTreatmentDecision {
  const reasons: TaxTreatmentDenyReason[] = [];

  if (input.profile === null) {
    return {
      allowed: false,
      reasons: [TaxTreatmentDenyReason.NO_TAX_PROFILE],
      vatLine: null,
    };
  }
  if (input.ratesInForce === null) {
    return {
      allowed: false,
      reasons: [TaxTreatmentDenyReason.RULE_VERSION_MISSING],
      vatLine: null,
    };
  }

  const { profile } = input;
  const charging =
    input.vatAmountKopecks !== null && input.vatAmountKopecks !== 0n;

  if (profile.vatStatus === VatStatus.PAYER) {
    if (profile.vatExemptionGround !== null) {
      reasons.push(TaxTreatmentDenyReason.EXEMPTION_GROUND_ON_NON_EXEMPT);
    }
    if (input.statedRate === null) {
      reasons.push(TaxTreatmentDenyReason.VAT_MISSING_FOR_PAYER);
    } else if (!input.ratesInForce.includes(input.statedRate)) {
      reasons.push(TaxTreatmentDenyReason.RATE_NOT_IN_FORCE);
    }
    if (input.vatAmountKopecks === null) {
      reasons.push(TaxTreatmentDenyReason.VAT_MISSING_FOR_PAYER);
    }
    // A credit note carries a negative base and a negative VAT together. The
    // combination that is always wrong is a negative VAT on a positive base.
    if (
      input.vatAmountKopecks !== null &&
      input.vatAmountKopecks < 0n &&
      input.taxableBaseKopecks > 0n
    ) {
      reasons.push(TaxTreatmentDenyReason.NEGATIVE_VAT_ON_POSITIVE_BASE);
    }
  } else {
    if (charging) {
      reasons.push(TaxTreatmentDenyReason.VAT_CHARGED_WITHOUT_STATUS);
    }
    if (input.statedRate !== null) {
      reasons.push(TaxTreatmentDenyReason.RATE_STATED_WITHOUT_STATUS);
    }
    if (
      profile.vatStatus === VatStatus.EXEMPT &&
      (profile.vatExemptionGround === null ||
        profile.vatExemptionGround.trim().length === 0)
    ) {
      reasons.push(TaxTreatmentDenyReason.MISSING_EXEMPTION_GROUND);
    }
    if (
      profile.vatStatus === VatStatus.NOT_PAYER &&
      profile.vatExemptionGround !== null
    ) {
      // A non-payer citing an exemption is claiming a status it does not hold.
      reasons.push(TaxTreatmentDenyReason.EXEMPTION_GROUND_ON_NON_EXEMPT);
    }
  }

  if (reasons.length > 0) {
    return { allowed: false, reasons, vatLine: null };
  }

  if (profile.vatStatus === VatStatus.PAYER) {
    return {
      allowed: true,
      reasons: [],
      vatLine: `НДС ${input.statedRate}%`,
    };
  }
  return {
    allowed: true,
    reasons: [],
    vatLine:
      profile.vatStatus === VatStatus.EXEMPT
        ? `Без НДС (${profile.vatExemptionGround})`
        : 'Без НДС',
  };
}

export const TaxProfileDenyReason = {
  BLANK_VERSION_TAG: 'BLANK_VERSION_TAG',
  INVERTED_WINDOW: 'INVERTED_WINDOW',
  OVERLAPS_EXISTING_PROFILE: 'OVERLAPS_EXISTING_PROFILE',
  DUPLICATE_VERSION_TAG: 'DUPLICATE_VERSION_TAG',
  MISSING_EXEMPTION_GROUND: 'MISSING_EXEMPTION_GROUND',
  EXEMPTION_GROUND_ON_NON_EXEMPT: 'EXEMPTION_GROUND_ON_NON_EXEMPT',
} as const;

export type TaxProfileDenyReason =
  typeof TaxProfileDenyReason[keyof typeof TaxProfileDenyReason];

/**
 * May this profile version be recorded?
 *
 * Overlap is refused for the same reason as in the rule registry: two statuses
 * in force at one instant makes "was this organization charging VAT that day"
 * unanswerable, and every document issued in the overlap becomes unverifiable.
 */
export function evaluateTaxProfilePublication(input: {
  candidate: TaxProfileVersion;
  existing: readonly TaxProfileVersion[];
}): { allowed: boolean; reasons: readonly TaxProfileDenyReason[] } {
  const { candidate, existing } = input;
  const reasons: TaxProfileDenyReason[] = [];

  if (candidate.versionTag.trim().length === 0) {
    reasons.push(TaxProfileDenyReason.BLANK_VERSION_TAG);
  }
  if (
    candidate.effectiveTo !== null &&
    candidate.effectiveTo.getTime() <= candidate.effectiveFrom.getTime()
  ) {
    reasons.push(TaxProfileDenyReason.INVERTED_WINDOW);
  }
  if (
    candidate.vatStatus === VatStatus.EXEMPT &&
    (candidate.vatExemptionGround === null ||
      candidate.vatExemptionGround.trim().length === 0)
  ) {
    reasons.push(TaxProfileDenyReason.MISSING_EXEMPTION_GROUND);
  }
  if (
    candidate.vatStatus !== VatStatus.EXEMPT &&
    candidate.vatExemptionGround !== null
  ) {
    reasons.push(TaxProfileDenyReason.EXEMPTION_GROUND_ON_NON_EXEMPT);
  }

  const sameOrg = existing.filter(
    (profile) => profile.organizationId === candidate.organizationId,
  );

  if (sameOrg.some((profile) => profile.versionTag === candidate.versionTag)) {
    reasons.push(TaxProfileDenyReason.DUPLICATE_VERSION_TAG);
  }

  const candidateEnd =
    candidate.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  if (
    sameOrg.some((profile) => {
      if (profile.versionTag === candidate.versionTag) {
        return false;
      }
      const end = profile.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
      return (
        profile.effectiveFrom.getTime() < candidateEnd &&
        candidate.effectiveFrom.getTime() < end
      );
    })
  ) {
    reasons.push(TaxProfileDenyReason.OVERLAPS_EXISTING_PROFILE);
  }

  return { allowed: reasons.length === 0, reasons };
}
