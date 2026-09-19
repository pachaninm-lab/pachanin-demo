import { describe, expect, it } from 'vitest';

import {
  PLATFORM_V7_CANONICAL_ENTITIES,
  platformV7AssertCanonicalRead,
  platformV7AssertCanonicalWrite,
  platformV7CanonicalEntityFor,
  platformV7CanonicalReadDecision,
  platformV7CanonicalWriteDecision,
  type PlatformV7CanonicalEntityType,
} from '../../../src/platform-v7/canonical-data';

const entityTypes: readonly PlatformV7CanonicalEntityType[] = [
  'deal',
  'participant',
  'logisticsOrder',
  'qualityResult',
  'moneyBasis',
  'disputeCase',
  'auditEntry',
  'supportCase',
];

describe('platform-v7 canonical data boundary', () => {
  it('declares a typed source and policy for every canonical entity', () => {
    expect(Object.keys(PLATFORM_V7_CANONICAL_ENTITIES).sort()).toEqual([...entityTypes].sort());

    for (const entityType of entityTypes) {
      const entity = PLATFORM_V7_CANONICAL_ENTITIES[entityType];

      expect(entity.entityType).toBe(entityType);
      expect(entity.canonicalSource).toMatch(/read-model|control-plane/);
      expect(entity.ownerRoles.length).toBeGreaterThan(0);
      expect(entity.notes).not.toMatch(/production-ready|fully live|fully integrated|bank connected|FGIS connected|EDO connected/i);
    }
  });

  it('resolves known entities and rejects unknown entity ids', () => {
    expect(platformV7CanonicalEntityFor('deal')).toMatchObject({
      entityType: 'deal',
      canonicalSource: 'platform-v7-control-plane',
    });
    expect(platformV7CanonicalEntityFor('unknown')).toBeNull();
    expect(platformV7CanonicalReadDecision('operator', 'unknown')).toMatchObject({
      allowed: false,
      reason: 'unknown-entity',
      entity: null,
    });
  });

  it('allows role-owned canonical reads only', () => {
    expect(platformV7CanonicalReadDecision('seller', 'deal')).toMatchObject({
      allowed: true,
      reason: 'canonical-source-selected',
    });
    expect(platformV7CanonicalReadDecision('driver', 'moneyBasis')).toMatchObject({
      allowed: false,
      reason: 'role-not-owner',
    });
    expect(platformV7CanonicalReadDecision('executive', 'auditEntry')).toMatchObject({
      allowed: true,
      reason: 'canonical-source-selected',
    });
  });

  it('keeps money basis and audit entries read-only', () => {
    expect(platformV7CanonicalWriteDecision('bank', 'moneyBasis')).toMatchObject({
      allowed: false,
      reason: 'write-blocked',
    });
    expect(platformV7CanonicalWriteDecision('compliance', 'auditEntry')).toMatchObject({
      allowed: false,
      reason: 'write-blocked',
    });
  });

  it('allows controlled-pilot writes only inside owned non-live entities', () => {
    expect(platformV7CanonicalWriteDecision('operator', 'deal')).toMatchObject({
      allowed: true,
      reason: 'canonical-source-selected',
    });
    expect(platformV7CanonicalWriteDecision('lab', 'qualityResult')).toMatchObject({
      allowed: true,
      reason: 'canonical-source-selected',
    });
    expect(platformV7CanonicalWriteDecision('bank', 'qualityResult')).toMatchObject({
      allowed: false,
      reason: 'role-not-owner',
    });
  });

  it('throws explicit boundary errors for rejected reads and writes', () => {
    expect(() => platformV7AssertCanonicalRead('driver', 'moneyBasis')).toThrow(
      'platform-v7 canonical read rejected: role-not-owner',
    );
    expect(() => platformV7AssertCanonicalWrite('bank', 'moneyBasis')).toThrow(
      'platform-v7 canonical write rejected: write-blocked',
    );
    expect(() => platformV7AssertCanonicalWrite('operator', 'deal')).not.toThrow();
  });
});
