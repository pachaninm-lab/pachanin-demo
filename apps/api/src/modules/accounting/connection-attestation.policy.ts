/**
 * What it takes for a connection's contract to count as attested.
 *
 * The governance artefact is the platform's existing four-gate attestation, and
 * these are its gates, unchanged. Four exist so that four people look at a
 * connection before the platform is allowed to say anything good about it: the
 * owner, security, legal and operations each answer for their own question, and
 * one person answering two of them turns four-eyes into two. The database
 * refuses that; this module only decides what the answers add up to.
 */

export const AttestationGate = {
  OWNER: 'OWNER',
  SECURITY: 'SECURITY',
  LEGAL: 'LEGAL',
  OPERATIONS: 'OPERATIONS',
} as const;
export type AttestationGate = (typeof AttestationGate)[keyof typeof AttestationGate];

export const REQUIRED_GATES: readonly AttestationGate[] = Object.freeze([
  AttestationGate.OWNER,
  AttestationGate.SECURITY,
  AttestationGate.LEGAL,
  AttestationGate.OPERATIONS,
]);

export const AttestationDecision = {
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type AttestationDecision =
  (typeof AttestationDecision)[keyof typeof AttestationDecision];

/** One gate's answer, as the database returns it. */
export interface GateAnswer {
  readonly gate: AttestationGate;
  readonly decision: AttestationDecision;
}

export interface AttestationState {
  /** True only when all four gates are APPROVED and none has expired. */
  readonly attested: boolean;
  /** Gates nobody has answered yet, or whose answer has lapsed. */
  readonly awaiting: readonly AttestationGate[];
  /** Gates that were answered REJECTED. */
  readonly rejected: readonly AttestationGate[];
}

/**
 * What the answers add up to.
 *
 * Only live answers reach here — the reader in the database drops anything past
 * its validity window and anything bound to a version the subject has moved on
 * from, so an attestation cannot quietly outlive either its own deadline or the
 * thing it was about.
 *
 * A single REJECTED gate is enough to withhold attestation even if the other
 * three approved, and it is reported separately from a gate nobody has reached:
 * "legal said no" and "legal has not looked" are different situations for
 * whoever has to act on them.
 */
export function describeAttestation(
  answers: readonly GateAnswer[],
): AttestationState {
  const approved = new Set<string>();
  const rejected: AttestationGate[] = [];

  for (const gate of REQUIRED_GATES) {
    const answer = answers.find((each) => each.gate === gate);
    if (answer === undefined) {
      continue;
    }
    if (answer.decision === AttestationDecision.REJECTED) {
      rejected.push(gate);
      continue;
    }
    approved.add(gate);
  }

  const awaiting = REQUIRED_GATES.filter(
    (gate) => approved.has(gate) === false && rejected.includes(gate) === false,
  );

  return {
    attested: awaiting.length === 0 && rejected.length === 0,
    awaiting,
    rejected,
  };
}

export function isGate(value: string): value is AttestationGate {
  return (REQUIRED_GATES as readonly string[]).includes(value);
}

export function isDecision(value: string): value is AttestationDecision {
  return value === AttestationDecision.APPROVED
    || value === AttestationDecision.REJECTED;
}
