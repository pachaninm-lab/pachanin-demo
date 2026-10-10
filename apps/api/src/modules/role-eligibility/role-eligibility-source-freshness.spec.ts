import { eligibilityEvaluationSourceState } from './role-eligibility-worker.service';

describe('Role Eligibility source freshness evaluation', () => {
  const future = new Date('2030-01-02T00:00:00.000Z');
  const past = new Date('2029-12-31T00:00:00.000Z');
  const now = new Date('2030-01-01T00:00:00.000Z').getTime();

  it('keeps a fresh validated ACTIVE generation usable in degraded mode when refresh schema changes', () => {
    expect(eligibilityEvaluationSourceState({
      status: 'SCHEMA_CHANGED',
      activeGeneration: 'generation-1',
      freshUntil: future,
    }, now)).toBe('DEGRADED');
  });

  it('keeps a fresh validated ACTIVE generation usable in degraded mode during source outage', () => {
    expect(eligibilityEvaluationSourceState({
      status: 'UNAVAILABLE',
      activeGeneration: 'generation-1',
      freshUntil: future,
    }, now)).toBe('DEGRADED');
  });

  it('fails closed once the active generation freshness expires', () => {
    expect(eligibilityEvaluationSourceState({
      status: 'UNAVAILABLE',
      activeGeneration: 'generation-1',
      freshUntil: past,
    }, now)).toBe('STALE');
  });

  it('does not disguise a degraded source without any active generation as usable', () => {
    expect(eligibilityEvaluationSourceState({
      status: 'DEGRADED',
      activeGeneration: null,
      freshUntil: future,
    }, now)).toBe('UNAVAILABLE');
  });
});
