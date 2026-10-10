// Validate measured terminal outcomes; fixture cardinalities are assertions, not
// a substitute for reading the final database snapshot.
export function validateRuntimeCounts({ snapshot, exactHead, runId, ambiguity, leaseSnapshot }) {
  const violations = [];
  const expected = new Map([
    ['graceful', [1, 1, 0, 0]],
    ['outage', [20, 20, 0, 0]],
    ['lease-kill', [1, 0, 0, 1]],
    ['poison', [1, 0, 1, 0]],
    ['poison-healthy', [20, 20, 0, 0]],
    ['backlog', [300, 300, 0, 0]],
  ]);
  if (!snapshot || snapshot.schemaVersion !== 1) violations.push('missingOrInvalidOutcomeSnapshot');
  if (!/^[0-9a-f]{40}$/u.test(exactHead || '') || snapshot?.commitSha !== exactHead) {
    violations.push('outcomeSnapshotExactHeadMismatch');
  }
  if (typeof runId !== 'string' || !runId || snapshot?.runId !== runId) {
    violations.push('outcomeSnapshotRunMismatch');
  }
  const outcomes = Array.isArray(snapshot?.outcomes) ? snapshot.outcomes : [];
  if (outcomes.length !== expected.size) violations.push('outcomeScenarioCount');
  const seen = new Set();
  const totals = { claimed: 0, delivered: 0, dead: 0, quarantined: 0 };
  let validNumbers = true;
  for (const outcome of outcomes) {
    const scenario = outcome?.scenario;
    const counts = ['total', 'delivered', 'dead', 'quarantined', 'invalid'].map((key) => outcome?.[key]);
    if (counts.some((value) => !Number.isSafeInteger(value) || value < 0)) {
      violations.push(`invalidOutcomeCounts:${scenario}`);
      validNumbers = false;
      continue;
    }
    if (!expected.has(scenario) || seen.has(scenario)) violations.push(`unexpectedOutcomeScenario:${scenario}`);
    seen.add(scenario);
    const wanted = expected.get(scenario);
    if (!wanted || wanted.some((value, index) => value !== counts[index])) {
      violations.push(`outcomeScenarioMismatch:${scenario}`);
    }
    if (counts[4] !== 0 || counts[0] !== counts[1] + counts[2] + counts[3]) {
      violations.push(`nonterminalOrInvalidOutcome:${scenario}`);
    }
    totals.claimed += counts[0];
    totals.delivered += counts[1];
    totals.dead += counts[2];
    totals.quarantined += counts[3];
  }
  for (const scenario of expected.keys()) {
    if (!seen.has(scenario)) violations.push(`missingOutcomeScenario:${scenario}`);
  }
  if (!validNumbers || outcomes.length === 0) {
    for (const key of Object.keys(totals)) totals[key] = null;
  }

  const parts = typeof ambiguity === 'string' ? ambiguity.trim().split('|') : [];
  const leaseParts = typeof leaseSnapshot === 'string' ? leaseSnapshot.trim().split('|') : [];
  const epoch = (value) => /^\d+$/u.test(value || '') && Number.isSafeInteger(Number(value)) && Number(value) > 0
    ? Number(value) : null;
  const quarantineEpoch = epoch(parts[3]);
  const leaseExpiryEpoch = epoch(leaseParts[2]);
  const leaseLost = leaseParts.length === 3 && leaseParts[0] && leaseParts[1] && leaseExpiryEpoch !== null ? 1 : null;
  if (leaseLost !== 1) violations.push('missingOrInvalidKilledLeaseSnapshot');
  const quarantine = {
    status: parts[0] || null,
    category: parts[1] || null,
    code: parts[2] || null,
    quarantineEpoch,
    leaseExpiryEpoch,
    leaseState: parts[4] || null,
    deliveryState: parts[5] || null,
  };
  if (parts.length !== 6 || quarantine.status !== 'MANUAL_REVIEW'
    || quarantine.category !== 'AMBIGUOUS' || quarantine.code !== 'WORKER_CRASH_OUTCOME_UNKNOWN'
    || quarantine.leaseState !== 'no-lease' || quarantine.deliveryState !== 'unsent') {
    violations.push('missingOrInvalidLeaseQuarantine');
  }
  if (quarantineEpoch === null || leaseExpiryEpoch === null || quarantineEpoch < leaseExpiryEpoch) {
    violations.push('quarantineBeforeLeaseExpiry');
  }
  if (typeof snapshot?.quarantineEvidence !== 'string'
    || snapshot.quarantineEvidence !== ambiguity?.trim()) {
    violations.push('finalQuarantineEvidenceMismatch');
  }
  return { violations, ...totals, leaseLost, quarantine };
}
