import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_DEAL_TRANSITIONS,
  PLATFORM_V7_DISPUTE_TRANSITIONS,
  PLATFORM_V7_TRIP_TRANSITIONS,
  platformV7DealTransition,
  platformV7DisputeTransition,
  platformV7TripTransition,
} from '@/lib/platform-v7/lifecycle';

describe('platform-v7 lifecycle rules', () => {
  it('allows ordered deal transitions', () => {
    expect(platformV7DealTransition('draft', 'awaiting_party_confirmation').allowed).toBe(true);
    expect(platformV7DealTransition('awaiting_money_reserve', 'money_reserved').allowed).toBe(true);
    expect(platformV7DealTransition('accepted', 'release_basis_ready').allowed).toBe(true);
    expect(platformV7DealTransition('release_requested', 'released').allowed).toBe(true);
    expect(platformV7DealTransition('released', 'closed').allowed).toBe(true);
  });

  it('blocks unsafe deal jumps', () => {
    expect(platformV7DealTransition('draft', 'released').allowed).toBe(false);
    expect(platformV7DealTransition('money_reserved', 'released').allowed).toBe(false);
    expect(platformV7DealTransition('release_basis_ready', 'released').allowed).toBe(false);
  });

  it('keeps dispute branch explicit', () => {
    expect(platformV7DealTransition('release_basis_ready', 'disputed').allowed).toBe(true);
    expect(platformV7DealTransition('disputed', 'release_basis_ready').allowed).toBe(true);
    expect(platformV7DealTransition('disputed', 'released').allowed).toBe(false);
  });

  it('allows ordered trip transitions and blocks unsafe jumps', () => {
    expect(platformV7TripTransition('created', 'carrier_assigned').allowed).toBe(true);
    expect(platformV7TripTransition('driver_assigned', 'accepted_by_driver').allowed).toBe(true);
    expect(platformV7TripTransition('loaded', 'departed').allowed).toBe(true);
    expect(platformV7TripTransition('accepted', 'completed').allowed).toBe(true);
    expect(platformV7TripTransition('created', 'completed').allowed).toBe(false);
    expect(platformV7TripTransition('driver_assigned', 'weighing').allowed).toBe(false);
  });

  it('keeps dispute flow ordered into bank basis and resolution', () => {
    expect(platformV7DisputeTransition('none', 'claim_created').allowed).toBe(true);
    expect(platformV7DisputeTransition('decision_issued', 'bank_basis_sent').allowed).toBe(true);
    expect(platformV7DisputeTransition('bank_basis_sent', 'resolved').allowed).toBe(true);
    expect(platformV7DisputeTransition('claim_created', 'resolved').allowed).toBe(false);
  });

  it('keeps transition registries explicit', () => {
    expect(PLATFORM_V7_DEAL_TRANSITIONS.length).toBeGreaterThan(0);
    expect(PLATFORM_V7_TRIP_TRANSITIONS.length).toBeGreaterThan(0);
    expect(PLATFORM_V7_DISPUTE_TRANSITIONS.length).toBeGreaterThan(0);
  });
});
