import {
  AttestationDecision,
  AttestationGate,
  describeAttestation,
  isDecision,
  isGate,
} from './connection-attestation.policy';

/**
 * What four answers add up to.
 *
 * The rule this exists to hold is that "attested" is all four, live, with none
 * rejected — never three out of four, never "mostly approved". A connection the
 * platform describes as attested is one that four different people signed off,
 * and the arithmetic that decides it is the part worth pinning down.
 */
describe('what the gates add up to', () => {
  const approved = (gate: AttestationGate) => ({
    gate,
    decision: AttestationDecision.APPROVED,
  });

  it('is not attested when nobody has answered', () => {
    const state = describeAttestation([]);

    expect(state.attested).toBe(false);
    expect(state.awaiting).toEqual([
      AttestationGate.OWNER,
      AttestationGate.SECURITY,
      AttestationGate.LEGAL,
      AttestationGate.OPERATIONS,
    ]);
    expect(state.rejected).toEqual([]);
  });

  it('is not attested on three of four', () => {
    const state = describeAttestation([
      approved(AttestationGate.OWNER),
      approved(AttestationGate.SECURITY),
      approved(AttestationGate.LEGAL),
    ]);

    // Three gates is the shape a platform is most likely to ship by accident:
    // enough approvals to look done, and the one nobody chased is the one that
    // would have said no.
    expect(state.attested).toBe(false);
    expect(state.awaiting).toEqual([AttestationGate.OPERATIONS]);
  });

  it('is attested on all four', () => {
    const state = describeAttestation([
      approved(AttestationGate.OWNER),
      approved(AttestationGate.SECURITY),
      approved(AttestationGate.LEGAL),
      approved(AttestationGate.OPERATIONS),
    ]);

    expect(state.attested).toBe(true);
    expect(state.awaiting).toEqual([]);
    expect(state.rejected).toEqual([]);
  });

  it('is not attested when one gate said no, however many said yes', () => {
    const state = describeAttestation([
      approved(AttestationGate.OWNER),
      approved(AttestationGate.SECURITY),
      { gate: AttestationGate.LEGAL, decision: AttestationDecision.REJECTED },
      approved(AttestationGate.OPERATIONS),
    ]);

    expect(state.attested).toBe(false);
    expect(state.rejected).toEqual([AttestationGate.LEGAL]);
    // And it is not reported as still awaiting legal: somebody looked and said
    // no, which is a different thing to do about than somebody not looking.
    expect(state.awaiting).toEqual([]);
  });

  it('separates a gate that refused from a gate nobody reached', () => {
    const state = describeAttestation([
      approved(AttestationGate.OWNER),
      { gate: AttestationGate.SECURITY, decision: AttestationDecision.REJECTED },
    ]);

    expect(state.rejected).toEqual([AttestationGate.SECURITY]);
    expect(state.awaiting).toEqual([
      AttestationGate.LEGAL,
      AttestationGate.OPERATIONS,
    ]);
  });

  it('reports the gates in the order they are meant to be worked', () => {
    const state = describeAttestation([approved(AttestationGate.LEGAL)]);

    // Answers arrive in whatever order people get to them; the report does not
    // inherit that order, because a list that reshuffles between reads is one
    // nobody can compare with the last one they saw.
    expect(state.awaiting).toEqual([
      AttestationGate.OWNER,
      AttestationGate.SECURITY,
      AttestationGate.OPERATIONS,
    ]);
  });

  it('does not accept a gate or a decision it does not know', () => {
    expect(isGate('OWNER')).toBe(true);
    expect(isGate('FINANCE')).toBe(false);
    expect(isDecision('APPROVED')).toBe(true);
    expect(isDecision('MAYBE')).toBe(false);
  });
});
