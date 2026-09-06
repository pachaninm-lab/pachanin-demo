export const FNS_EGRUL_OPEN_INFORMATION_SCOPE = 'FNS_EGRUL_OPEN_INFORMATION_STRUCTURE' as const;

export type FnsEgrulStatusFact = {
  code: string;
  name: string;
  liquidationDeadline: string | null;
  grn: string | null;
  recordedAt: string | null;
  accessRestricted: boolean;
};

export type FnsEgrulExclusionDecisionFact = {
  decisionDate: string;
  decisionNumber: string;
  publicationDate: string | null;
  journalNumber: string | null;
};

export type FnsEgrulTerminationFact = {
  terminatedAt: string;
  methodCode: string | null;
  methodName: string | null;
};

export type FnsEgrulReliabilityFact = {
  area: 'ADDRESS' | 'MANAGEMENT' | 'PARTICIPANT';
  basisCode: string;
  sourceTag: string;
};

export type FnsEgrulStatusEnvelope = {
  informationScope: typeof FNS_EGRUL_OPEN_INFORMATION_SCOPE;
  classification: 'ACTIVE' | 'SPECIAL_STATUS' | 'TERMINATED' | 'RESTRICTED_OR_UNKNOWN';
  visibleStatuses: FnsEgrulStatusFact[];
  exclusionDecisions: FnsEgrulExclusionDecisionFact[];
  termination: FnsEgrulTerminationFact | null;
  reliability: FnsEgrulReliabilityFact[];
  reorganizationPresent: boolean;
  accessRestricted: boolean;
  compatibilityActive: boolean;
  compatibilityStatus: 'ACTIVE' | 'TERMINATED' | 'REVIEW_REQUIRED';
};

export type FnsEgrulStatusPolicyInput = {
  visibleStatuses: readonly FnsEgrulStatusFact[];
  exclusionDecisions?: readonly FnsEgrulExclusionDecisionFact[];
  termination?: FnsEgrulTerminationFact | null;
  reliability?: readonly FnsEgrulReliabilityFact[];
  reorganizationPresent?: boolean;
  accessRestricted?: boolean;
};

function policyError(code: string): Error {
  const error = new Error(code);
  error.name = 'FnsEgrulStatusPolicyError';
  return error;
}

function validIsoDate(value: string | null): boolean {
  if (value === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime())
    && date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day;
}

function normalizeStatus(fact: FnsEgrulStatusFact): FnsEgrulStatusFact {
  const code = String(fact.code || '').trim();
  const name = String(fact.name || '').trim();
  const numeric = Number(code);
  if (!/^\d{3}$/u.test(code) || numeric <= 100 || numeric >= 900) {
    throw policyError('FNS_EGRUL_STATUS_CODE_INVALID');
  }
  if (name.length < 5 || name.length > 500) throw policyError('FNS_EGRUL_STATUS_NAME_INVALID');
  if (!validIsoDate(fact.liquidationDeadline)) throw policyError('FNS_EGRUL_STATUS_DATE_INVALID');
  if (!validIsoDate(fact.recordedAt)) throw policyError('FNS_EGRUL_STATUS_DATE_INVALID');
  if (fact.grn !== null && !/^\d{1,20}$/u.test(String(fact.grn))) throw policyError('FNS_EGRUL_STATUS_GRN_INVALID');
  return {
    code,
    name,
    liquidationDeadline: fact.liquidationDeadline,
    grn: fact.grn === null ? null : String(fact.grn),
    recordedAt: fact.recordedAt,
    accessRestricted: fact.accessRestricted === true,
  };
}

function normalizeDecision(fact: FnsEgrulExclusionDecisionFact): FnsEgrulExclusionDecisionFact {
  const decisionDate = String(fact.decisionDate || '').trim();
  const decisionNumber = String(fact.decisionNumber || '').trim();
  const publicationDate = fact.publicationDate === null ? null : String(fact.publicationDate || '').trim();
  const journalNumber = fact.journalNumber === null ? null : String(fact.journalNumber || '').trim();
  if (!validIsoDate(decisionDate)) throw policyError('FNS_EGRUL_EXCLUSION_DECISION_DATE_INVALID');
  if (!decisionNumber || decisionNumber.length > 255) throw policyError('FNS_EGRUL_EXCLUSION_DECISION_NUMBER_INVALID');
  if (!validIsoDate(publicationDate)) throw policyError('FNS_EGRUL_EXCLUSION_PUBLICATION_DATE_INVALID');
  if (journalNumber !== null && (!journalNumber || journalNumber.length > 50)) {
    throw policyError('FNS_EGRUL_EXCLUSION_JOURNAL_INVALID');
  }
  return { decisionDate, decisionNumber, publicationDate, journalNumber };
}

function normalizeTermination(fact: FnsEgrulTerminationFact | null | undefined): FnsEgrulTerminationFact | null {
  if (!fact) return null;
  const terminatedAt = String(fact.terminatedAt || '').trim();
  if (!validIsoDate(terminatedAt)) throw policyError('FNS_EGRUL_TERMINATION_DATE_INVALID');
  const methodCode = fact.methodCode === null ? null : String(fact.methodCode || '').trim();
  const methodName = fact.methodName === null ? null : String(fact.methodName || '').trim();
  if (methodCode !== null && !methodCode) throw policyError('FNS_EGRUL_TERMINATION_METHOD_INVALID');
  if (methodName !== null && !methodName) throw policyError('FNS_EGRUL_TERMINATION_METHOD_INVALID');
  return { terminatedAt, methodCode, methodName };
}

function normalizeReliability(fact: FnsEgrulReliabilityFact): FnsEgrulReliabilityFact {
  const area = fact.area;
  const basisCode = String(fact.basisCode || '').trim();
  const sourceTag = String(fact.sourceTag || '').trim();
  if (!['ADDRESS', 'MANAGEMENT', 'PARTICIPANT'].includes(area)) throw policyError('FNS_EGRUL_RELIABILITY_AREA_INVALID');
  if (!/^[123]$/u.test(basisCode)) throw policyError('FNS_EGRUL_RELIABILITY_BASIS_INVALID');
  if (!sourceTag || sourceTag.length > 100) throw policyError('FNS_EGRUL_RELIABILITY_SOURCE_INVALID');
  return { area, basisCode, sourceTag };
}

function stableUnique<T>(values: readonly T[], key: (value: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const value of values) byKey.set(key(value), value);
  return [...byKey.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value);
}

export function interpretFnsEgrulStatus(input: FnsEgrulStatusPolicyInput): FnsEgrulStatusEnvelope {
  const visibleStatuses = stableUnique(
    (input.visibleStatuses || []).map(normalizeStatus),
    (fact) => [fact.code, fact.name, fact.recordedAt || '', fact.grn || '', fact.liquidationDeadline || '', fact.accessRestricted ? '1' : '0'].join('\u001f'),
  );
  const exclusionDecisions = stableUnique(
    (input.exclusionDecisions || []).map(normalizeDecision),
    (fact) => [fact.decisionDate, fact.decisionNumber, fact.publicationDate || '', fact.journalNumber || ''].join('\u001f'),
  );
  const termination = normalizeTermination(input.termination);
  const reliability = stableUnique(
    (input.reliability || []).map(normalizeReliability),
    (fact) => [fact.area, fact.basisCode, fact.sourceTag].join('\u001f'),
  );
  const reorganizationPresent = input.reorganizationPresent === true;
  const accessRestricted = input.accessRestricted === true || visibleStatuses.some((fact) => fact.accessRestricted);

  if (exclusionDecisions.length > 0 && !visibleStatuses.some((fact) => {
    const numeric = Number(fact.code);
    return numeric >= 105 && numeric <= 110;
  })) {
    throw policyError('FNS_EGRUL_EXCLUSION_DECISION_STATUS_MISMATCH');
  }

  if (!termination && visibleStatuses.some((fact) => {
    const numeric = Number(fact.code);
    return numeric > 200 && numeric < 700;
  })) {
    throw policyError('FNS_EGRUL_STATUS_TERMINATION_REQUIRED');
  }

  let classification: FnsEgrulStatusEnvelope['classification'];
  let compatibilityActive: boolean;
  let compatibilityStatus: FnsEgrulStatusEnvelope['compatibilityStatus'];

  if (termination) {
    classification = 'TERMINATED';
    compatibilityActive = false;
    compatibilityStatus = 'TERMINATED';
  } else if (accessRestricted || (reorganizationPresent && visibleStatuses.length === 0)) {
    classification = 'RESTRICTED_OR_UNKNOWN';
    compatibilityActive = false;
    compatibilityStatus = 'REVIEW_REQUIRED';
  } else if (visibleStatuses.length > 0 || reorganizationPresent) {
    classification = 'SPECIAL_STATUS';
    compatibilityActive = false;
    compatibilityStatus = 'REVIEW_REQUIRED';
  } else {
    classification = 'ACTIVE';
    compatibilityActive = true;
    compatibilityStatus = 'ACTIVE';
  }

  return {
    informationScope: FNS_EGRUL_OPEN_INFORMATION_SCOPE,
    classification,
    visibleStatuses,
    exclusionDecisions,
    termination,
    reliability,
    reorganizationPresent,
    accessRestricted,
    compatibilityActive,
    compatibilityStatus,
  };
}
