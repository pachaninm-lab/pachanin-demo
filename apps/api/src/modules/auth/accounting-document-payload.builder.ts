import { createHash } from 'node:crypto';
import { DocumentSource, type SourceRevisions } from './accounting-document-staleness.policy';

/**
 * Assembling a УПД from what the platform already knows.
 *
 * The last component of the accounting contour, and the one where a plausible
 * design quietly breaks everything built before it. A УПД draws on the deal,
 * the execution, the weight, the quality, the price, the contract version, the
 * counterparty requisites, the tax profile and the regulatory rule. Every one
 * of those is versioned, and the document version records which revision of
 * each it used — that snapshot is what makes staleness detectable at all.
 *
 * So the payload and the snapshot are produced **together, from one read**.
 * Building the document and then asking each source for its current revision
 * would record what is true at the moment of asking, not what went into the
 * document; a source that moved in between would be recorded as the revision
 * the document did not use, and the staleness check would report CURRENT
 * forever. The single `SourceSnapshot` argument is what makes that mistake
 * unavailable rather than merely discouraged.
 *
 * The second decision is that the document **restates** money and never
 * recomputes it. The total comes from the deal as recorded. Multiplying price
 * by volume here would introduce a second arithmetic that can disagree with
 * the ledger's, and the disagreement would show up as a document that does not
 * match the settlement — which is exactly the kind of discrepancy an
 * accounting document exists to rule out. A deal with no recorded total is
 * refused instead.
 */

/** One source, as read: its revision and the fields the document takes from it. */
export type SourceRead<T> = {
  /** The revision recorded in the snapshot for this source. */
  revision: string;
  value: T;
};

export type DealRead = {
  dealId: string;
  dealNumber: string | null;
  sellerOrgId: string;
  buyerOrgId: string;
  currency: string;
  /** Kopecks, as recorded on the deal. Never recomputed here. */
  totalKopecks: bigint | null;
};

export type GoodsRead = {
  culture: string | null;
  cropClass: string | null;
  gost: string | null;
};

export type WeightRead = {
  /** Grams, integer. Weight is measured, so it is never a float either. */
  netWeightGrams: bigint | null;
};

export type RequisitesRead = {
  sellerInn: string | null;
  buyerInn: string | null;
};

export type TaxRead = {
  /** Already decided by organization-tax-profile.policy.ts. */
  vatLine: string;
  vatAmountKopecks: bigint | null;
};

export type SourceSnapshot = {
  deal: SourceRead<DealRead>;
  execution: SourceRead<GoodsRead>;
  weight: SourceRead<WeightRead>;
  quality: SourceRead<{ qualityPassportId: string | null }>;
  price: SourceRead<{ pricePerTonKopecks: bigint | null }>;
  contractVersion: SourceRead<{ contractNumber: string | null }>;
  counterpartyRequisites: SourceRead<RequisitesRead>;
  taxProfile: SourceRead<TaxRead>;
  regulatoryRule: SourceRead<{ formatRevision: string | null }>;
};

export const PayloadDenyReason = {
  UNSUPPORTED_DOCUMENT_TYPE: 'UNSUPPORTED_DOCUMENT_TYPE',
  MISSING_TOTAL: 'MISSING_TOTAL',
  MISSING_WEIGHT: 'MISSING_WEIGHT',
  MISSING_CULTURE: 'MISSING_CULTURE',
  MISSING_REQUISITES: 'MISSING_REQUISITES',
  MISSING_CONTRACT: 'MISSING_CONTRACT',
  BLANK_SOURCE_REVISION: 'BLANK_SOURCE_REVISION',
  UNSUPPORTED_CURRENCY: 'UNSUPPORTED_CURRENCY',
} as const;

export type PayloadDenyReason =
  typeof PayloadDenyReason[keyof typeof PayloadDenyReason];

export type BuiltPayload = {
  payload: Readonly<Record<string, unknown>>;
  recordedRevisions: SourceRevisions;
  payloadHash: string;
  totalKopecks: bigint;
};

export type BuildResult =
  | { built: true; result: BuiltPayload }
  | { built: false; reasons: readonly PayloadDenyReason[] };

/**
 * Deterministic serialisation, so the same content always hashes the same.
 *
 * Object key order is insertion order in JavaScript, and an object assembled
 * by a different code path can carry the same fields in a different order.
 * Hashing that directly would make an identical document look like a changed
 * one on every regeneration, and a hash that changes without the content
 * changing is worse than no hash: it trains people to ignore it.
 *
 * `bigint` is serialised as a decimal string rather than through JSON's
 * default, which throws on it. Money never becomes a `number` on the way to
 * the hash either.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'bigint' ? `"${value.toString()}"` : JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
    .join(',')}}`;
}

export function hashPayload(payload: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex')}`;
}

const SUPPORTED_CURRENCIES = new Set(['RUB']);

function revisionReasons(snapshot: SourceSnapshot): PayloadDenyReason[] {
  const blank = Object.values(snapshot).some(
    (read) => read.revision.trim().length === 0,
  );
  return blank ? [PayloadDenyReason.BLANK_SOURCE_REVISION] : [];
}

/**
 * Build a УПД payload and the snapshot that vouches for it.
 *
 * Only UPD is supported, and an unrecognised type is refused rather than
 * rendered generically. A document type nobody wrote a builder for has no
 * agreed shape, and emitting a shapeless one would put the platform's name on
 * a form it cannot defend.
 */
export function buildDocumentPayload(input: {
  documentType: string;
  snapshot: SourceSnapshot;
}): BuildResult {
  const { snapshot } = input;

  if (input.documentType !== 'UPD') {
    return {
      built: false,
      reasons: [PayloadDenyReason.UNSUPPORTED_DOCUMENT_TYPE],
    };
  }

  const reasons: PayloadDenyReason[] = [...revisionReasons(snapshot)];

  const deal = snapshot.deal.value;
  if (deal.totalKopecks === null) {
    // Refused rather than computed from price × volume: a second arithmetic
    // here can disagree with the ledger's, and a document that does not match
    // the settlement is the discrepancy this document exists to rule out.
    reasons.push(PayloadDenyReason.MISSING_TOTAL);
  }
  if (!SUPPORTED_CURRENCIES.has(deal.currency)) {
    reasons.push(PayloadDenyReason.UNSUPPORTED_CURRENCY);
  }
  if (snapshot.weight.value.netWeightGrams === null) {
    reasons.push(PayloadDenyReason.MISSING_WEIGHT);
  }
  if (snapshot.execution.value.culture === null) {
    reasons.push(PayloadDenyReason.MISSING_CULTURE);
  }
  const requisites = snapshot.counterpartyRequisites.value;
  if (requisites.sellerInn === null || requisites.buyerInn === null) {
    // A УПД without both ИНН cannot be matched to a counterparty by anyone
    // receiving it, which makes it a document that only looks like one.
    reasons.push(PayloadDenyReason.MISSING_REQUISITES);
  }
  if (snapshot.contractVersion.value.contractNumber === null) {
    reasons.push(PayloadDenyReason.MISSING_CONTRACT);
  }

  if (reasons.length > 0 || deal.totalKopecks === null) {
    return { built: false, reasons };
  }

  const payload = {
    documentType: 'UPD',
    deal: {
      id: deal.dealId,
      number: deal.dealNumber,
      sellerOrgId: deal.sellerOrgId,
      buyerOrgId: deal.buyerOrgId,
    },
    contract: { number: snapshot.contractVersion.value.contractNumber },
    goods: {
      culture: snapshot.execution.value.culture,
      cropClass: snapshot.execution.value.cropClass,
      gost: snapshot.execution.value.gost,
      qualityPassportId: snapshot.quality.value.qualityPassportId,
      netWeightGrams: snapshot.weight.value.netWeightGrams,
    },
    money: {
      currency: deal.currency,
      pricePerTonKopecks: snapshot.price.value.pricePerTonKopecks,
      totalKopecks: deal.totalKopecks,
      vatLine: snapshot.taxProfile.value.vatLine,
      vatAmountKopecks: snapshot.taxProfile.value.vatAmountKopecks,
    },
    requisites: {
      sellerInn: requisites.sellerInn,
      buyerInn: requisites.buyerInn,
    },
    format: { revision: snapshot.regulatoryRule.value.formatRevision },
  } as const;

  // Derived from the same object the fields above were read from, so the two
  // cannot describe different reads.
  const recordedRevisions: SourceRevisions = {
    [DocumentSource.DEAL]: snapshot.deal.revision,
    [DocumentSource.EXECUTION]: snapshot.execution.revision,
    [DocumentSource.WEIGHT]: snapshot.weight.revision,
    [DocumentSource.QUALITY]: snapshot.quality.revision,
    [DocumentSource.PRICE]: snapshot.price.revision,
    [DocumentSource.CONTRACT_VERSION]: snapshot.contractVersion.revision,
    [DocumentSource.COUNTERPARTY_REQUISITES]:
      snapshot.counterpartyRequisites.revision,
    [DocumentSource.TAX_PROFILE]: snapshot.taxProfile.revision,
    [DocumentSource.REGULATORY_RULE]: snapshot.regulatoryRule.revision,
  };

  return {
    built: true,
    result: {
      payload,
      recordedRevisions,
      payloadHash: hashPayload(payload),
      totalKopecks: deal.totalKopecks,
    },
  };
}
