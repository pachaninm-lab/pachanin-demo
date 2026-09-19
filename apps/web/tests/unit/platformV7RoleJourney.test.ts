import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_ROLE_JOURNEYS,
  platformV7JourneyForRole,
  platformV7NextJourneyStep,
  platformV7RoleCanMutateFromJourney,
} from '@/lib/platform-v7/role-journey';

describe('platform-v7 role journey foundation', () => {
  it('defines a journey for every required role', () => {
    expect(Object.keys(PLATFORM_V7_ROLE_JOURNEYS).sort()).toEqual([
      'arbitrator',
      'bank',
      'buyer',
      'compliance',
      'driver',
      'elevator',
      'executive',
      'lab',
      'logistics',
      'operator',
      'seller',
      'surveyor',
    ]);

    for (const steps of Object.values(PLATFORM_V7_ROLE_JOURNEYS)) {
      expect(steps.length).toBeGreaterThan(0);
    }
  });

  it('keeps every step role-scoped and actionable', () => {
    for (const [role, steps] of Object.entries(PLATFORM_V7_ROLE_JOURNEYS)) {
      for (const step of steps) {
        expect(step.allowedRole).toBe(role);
        expect(step.stepId).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.primaryAction).toBeTruthy();
        expect(step.resource).toBeTruthy();
      }
    }
  });

  it('keeps driver journey restricted to trip work', () => {
    expect(platformV7JourneyForRole('driver').every((step) => step.resource === 'trip')).toBe(true);
    expect(platformV7JourneyForRole('driver').map((step) => step.resource)).not.toContain('money');
    expect(platformV7JourneyForRole('driver').map((step) => step.resource)).not.toContain('aggregate');
  });

  it('keeps executive viewer non-mutating', () => {
    expect(platformV7RoleCanMutateFromJourney('executive')).toBe(false);
    expect(platformV7JourneyForRole('executive').every((step) => !step.mutatesDeal)).toBe(true);
  });

  it('returns the next uncompleted role step', () => {
    expect(platformV7NextJourneyStep('buyer', [])?.stepId).toBe('buyer_rfq');
    expect(platformV7NextJourneyStep('buyer', ['buyer_rfq'])?.stepId).toBe('buyer_offer');
    expect(platformV7NextJourneyStep('buyer', ['buyer_rfq', 'buyer_offer', 'buyer_reserve'])).toBeNull();
  });

  it('keeps operational roles mutating through explicit journey steps', () => {
    expect(platformV7RoleCanMutateFromJourney('seller')).toBe(true);
    expect(platformV7RoleCanMutateFromJourney('buyer')).toBe(true);
    expect(platformV7RoleCanMutateFromJourney('bank')).toBe(true);
    expect(platformV7RoleCanMutateFromJourney('operator')).toBe(true);
  });
});
