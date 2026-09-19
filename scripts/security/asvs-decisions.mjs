// Applicability and status decisions for ASVS requirements.
//
// The point of this module is to make an unearned PASS impossible to express.
// Inventorying a requirement is not assessing it, and having a control - MFA,
// RLS, CodeQL, an SBOM, a passing test - is not evidence that a specific
// requirement is met. Every decision must name what was examined, and every
// decision carries conditions that are re-evaluated on each run, so a decision
// cannot outlive the facts that justified it.

export const APPLICABILITY = Object.freeze({
  APPLICABLE: 'APPLICABLE',
  NOT_APPLICABLE: 'NOT_APPLICABLE_WITH_JUSTIFICATION',
  PENDING: 'PENDING_APPLICABILITY_REVIEW',
});

export const STATUS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  NOT_ASSESSED: 'NOT_ASSESSED',
});

const VALID_APPLICABILITY = new Set(Object.values(APPLICABILITY));
const VALID_STATUS = new Set(Object.values(STATUS));

/**
 * Blocks a final pass no matter how few remain.
 *
 * A requirement justified as NOT_APPLICABLE does not block: it was decided, with
 * evidence and re-verified conditions. An APPLICABLE requirement that is still
 * unassessed does block - that is the case a percentage would hide.
 */
export function blocksFinalPass(record) {
  if (record.applicability === APPLICABILITY.PENDING) return true;
  if (record.applicability === APPLICABILITY.NOT_APPLICABLE) return record.status !== STATUS.NOT_APPLICABLE;
  return record.status !== STATUS.PASS;
}

/**
 * A decision is rejected unless it is fully formed. Rejection is deliberate:
 * a malformed decision must not silently degrade to PENDING, because that would
 * let a typo quietly remove a requirement from assessment.
 */
export function validateDecision(decision) {
  const problems = [];
  const id = String(decision?.requirementId ?? '');

  if (!/^V\d+\.\d+\.\d+$/u.test(id)) problems.push('requirementId is not an ASVS requirement id');
  if (!VALID_APPLICABILITY.has(decision?.applicability)) problems.push('applicability is not a recognised value');
  if (!VALID_STATUS.has(decision?.status)) problems.push('status is not a recognised value');

  const evidence = Array.isArray(decision?.evidence) ? decision.evidence.filter((item) => String(item ?? '').trim()) : [];
  const conditions = Array.isArray(decision?.conditions) ? decision.conditions : [];
  const note = String(decision?.note ?? '').trim();

  // NOT_APPLICABLE needs a technical justification, and PASS needs evidence.
  // Neither may rest on an assertion alone.
  if (decision?.applicability === APPLICABILITY.NOT_APPLICABLE) {
    if (evidence.length === 0) problems.push('NOT_APPLICABLE requires evidence');
    if (conditions.length === 0) problems.push('NOT_APPLICABLE requires at least one re-verifiable condition');
    if (decision?.status !== STATUS.NOT_APPLICABLE) problems.push('a justified non-applicable requirement must carry status NOT_APPLICABLE');
  }

  if (decision?.status === STATUS.PASS) {
    if (decision?.applicability !== APPLICABILITY.APPLICABLE) problems.push('PASS requires the requirement to be APPLICABLE');
    if (evidence.length === 0) problems.push('PASS requires evidence');
    if (conditions.length === 0) problems.push('PASS requires at least one re-verifiable condition');
  }

  // A FAIL is held to the same standard as a PASS. It must name where the gap
  // is and carry a condition that is re-checked on every run, so that when the
  // gap is closed the decision stops holding and the requirement is reassessed.
  // Otherwise a fixed finding would sit in the matrix as a permanent FAIL.
  if (decision?.status === STATUS.FAIL) {
    if (note.length === 0) problems.push('FAIL requires a note describing the gap');
    if (evidence.length === 0) problems.push('FAIL requires evidence naming where the gap is');
    if (conditions.length === 0) problems.push('FAIL requires at least one re-verifiable condition');
  }

  if (decision?.applicability === APPLICABILITY.PENDING && decision?.status !== STATUS.NOT_ASSESSED) {
    problems.push('a pending requirement cannot carry an assessment status');
  }

  return { id, problems, valid: problems.length === 0 };
}

/** All conditions must hold. A decision whose basis has changed is not a decision. */
export function conditionsHold(decision) {
  const conditions = Array.isArray(decision?.conditions) ? decision.conditions : [];
  return conditions.length > 0 && conditions.every((condition) => condition?.holds === true);
}

/**
 * Applies decisions to the inventoried requirements. Anything without a valid,
 * currently-holding decision stays PENDING and NOT_ASSESSED - the honest
 * default, and the one that keeps finalPass false.
 */
export function applyDecisions(requirements, decisions) {
  const byId = new Map();
  const rejected = [];

  for (const decision of decisions ?? []) {
    const validation = validateDecision(decision);
    if (!validation.valid) {
      rejected.push({ requirementId: validation.id || '(unparseable)', problems: validation.problems });
      continue;
    }
    if (byId.has(validation.id)) {
      rejected.push({ requirementId: validation.id, problems: ['duplicate decision for the same requirement'] });
      continue;
    }
    if (!conditionsHold(decision)) {
      rejected.push({
        requirementId: validation.id,
        problems: [`condition no longer holds: ${(decision.conditions ?? []).filter((c) => c?.holds !== true).map((c) => c?.condition ?? '?').join('; ')}`],
      });
      continue;
    }
    byId.set(validation.id, decision);
  }

  const known = new Set(requirements.map((requirement) => requirement.reqId));
  for (const id of byId.keys()) {
    if (!known.has(id)) {
      rejected.push({ requirementId: id, problems: ['decision references a requirement absent from the pinned standard'] });
      byId.delete(id);
    }
  }

  const records = requirements.map((requirement) => {
    const decision = byId.get(requirement.reqId);
    if (!decision) {
      return {
        reqId: requirement.reqId,
        level: requirement.level,
        applicability: APPLICABILITY.PENDING,
        status: STATUS.NOT_ASSESSED,
        evidenceRef: '',
        note: 'Evidence assessment required; no compliance status inferred.',
      };
    }
    return {
      reqId: requirement.reqId,
      level: requirement.level,
      applicability: decision.applicability,
      status: decision.status,
      evidenceRef: (decision.evidence ?? []).join(' '),
      note: String(decision.note ?? '').trim(),
    };
  });

  return { records, rejected };
}

export function summariseDecisions(records) {
  const applicabilityCounts = {};
  const statusCounts = {};
  for (const record of records) {
    applicabilityCounts[record.applicability] = (applicabilityCounts[record.applicability] ?? 0) + 1;
    statusCounts[record.status] = (statusCounts[record.status] ?? 0) + 1;
  }

  const blocking = records.filter(blocksFinalPass);
  const failed = records.filter((record) => record.status === STATUS.FAIL);
  const unassessedApplicable = records.filter((record) => (
    record.applicability === APPLICABILITY.APPLICABLE && record.status === STATUS.NOT_ASSESSED
  ));
  const blockers = [];
  if (unassessedApplicable.length > 0) blockers.push(`NOT_ASSESSED:${unassessedApplicable.length}`);
  if (applicabilityCounts[APPLICABILITY.PENDING]) blockers.push(`PENDING_APPLICABILITY_REVIEW:${applicabilityCounts[APPLICABILITY.PENDING]}`);
  if (failed.length > 0) blockers.push(`FAIL:${failed.length}`);

  return {
    applicabilityCounts,
    statusCounts,
    blockers,
    // A final pass requires that nothing is unassessed, nothing is pending and
    // nothing failed. It is never inferred from a percentage.
    finalPass: blocking.length === 0 && failed.length === 0 && records.length > 0,
  };
}
