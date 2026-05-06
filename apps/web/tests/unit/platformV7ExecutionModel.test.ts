import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_EXECUTION_CHAIN,
  PLATFORM_V7_EXECUTION_ROLES,
  isPlatformV7MoneyTreeBalanced,
  type PlatformV7DocumentRequirement,
  type PlatformV7MoneyTree,
} from '@/lib/platform-v7/execution-model';

describe('platform-v7 execution model contracts', () => {
  it('keeps the canonical execution chain ordered from batch to closed deal', () => {
    expect(PLATFORM_V7_EXECUTION_CHAIN[0]).toBe('batch');
    expect(PLATFORM_V7_EXECUTION_CHAIN).toContain('money_reserve');
    expect(PLATFORM_V7_EXECUTION_CHAIN).toContain('fgis_sdiz');
    expect(PLATFORM_V7_EXECUTION_CHAIN).toContain('documents');
    expect(PLATFORM_V7_EXECUTION_CHAIN).toContain('money_release_or_hold');
    expect(PLATFORM_V7_EXECUTION_CHAIN.at(-1)).toBe('closed');
  });

  it('keeps every controlled-pilot role represented in the execution model', () => {
    expect(PLATFORM_V7_EXECUTION_ROLES).toEqual([
      'seller',
      'buyer',
      'logistics',
      'driver',
      'elevator',
      'lab',
      'surveyor',
      'bank',
      'operator',
      'arbitrator',
      'compliance',
      'investor',
      'executive',
    ]);
  });

  it('treats money buckets as parts of one deal amount, not independent money', () => {
    const balancedTree: PlatformV7MoneyTree = {
      id: 'money-1',
      dealId: 'deal-1',
      totalDealAmountRub: 1_000,
      reservedAmountRub: 1_000,
      readyToReleaseRub: 400,
      heldAmountRub: 200,
      disputedAmountRub: 100,
      manualReviewAmountRub: 100,
      releasedAmountRub: 100,
      returnedAmountRub: 50,
      feeAmountRub: 50,
      reconciliationStatus: 'balanced',
    };

    const brokenTree = { ...balancedTree, readyToReleaseRub: 900, heldAmountRub: 900 };

    expect(isPlatformV7MoneyTreeBalanced(balancedTree)).toBe(true);
    expect(isPlatformV7MoneyTreeBalanced(brokenTree)).toBe(false);
  });

  it('requires each document to have an owner, blocking effect and next action', () => {
    const requirement: PlatformV7DocumentRequirement = {
      id: 'doc-1',
      dealId: 'deal-1',
      type: 'sdiz',
      responsibleRole: 'seller',
      status: 'missing',
      blocks: 'shipment',
      nextAction: {
        id: 'next-1',
        title: 'Оформить СДИЗ',
        responsibleRole: 'seller',
        targetRoute: '/platform-v7/documents',
        createsAuditEvent: true,
      },
      source: 'fgis',
    };

    expect(requirement.responsibleRole).toBe('seller');
    expect(requirement.blocks).toBe('shipment');
    expect(requirement.nextAction.createsAuditEvent).toBe(true);
  });
});
