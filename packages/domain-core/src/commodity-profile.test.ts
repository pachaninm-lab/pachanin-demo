import { describe, expect, it } from 'vitest';
import {
  COMMODITY_ARCHETYPES,
  CommodityProfileError,
  assertCommodityProfileContentMutable,
  assertCommodityProfileTransition,
  assertNoCommodityProfileEffectiveOverlap,
  buildCommodityProfileVersion,
  hashCommodityProfileContent,
  type CommodityArchetype,
  type CommodityProfileContent,
} from './commodity-profile';

function profileContent(archetype: CommodityArchetype): CommodityProfileContent {
  const fresh = archetype === 'FRESH_PACKED' || archetype === 'GREENHOUSE_RECURRING';
  const organic = archetype === 'ORGANIC_EXPORT_QUARANTINE';
  return {
    canonicalCode: `PC.${archetype}`,
    display: { ru: `Профиль ${archetype}`, en: `Profile ${archetype}`, zh: `配置 ${archetype}` },
    archetype,
    purpose: 'Исполнение сделки с проверяемыми правилами продукта',
    classification: 'INTERNAL',
    productCodes: [{ system: 'INTERNAL', code: `PC-${archetype}`, sourceRef: 'S-TZ-001' }],
    units: [
      {
        code: 'TNE',
        dimension: 'MASS',
        symbol: 'т',
        isBase: true,
        precision: 6,
        numeratorToBase: '1',
        denominatorToBase: '1',
        sourceRef: 'S-TZ-001',
      },
      {
        code: 'PCT',
        dimension: 'PERCENT',
        symbol: '%',
        isBase: true,
        precision: 3,
        numeratorToBase: '1',
        denominatorToBase: '1',
        sourceRef: 'S-TZ-001',
      },
    ],
    qualityIndicators: [
      {
        code: fresh ? 'TEMPERATURE' : 'MOISTURE',
        display: { ru: fresh ? 'Температура' : 'Влажность' },
        unitCode: 'PCT',
        precision: 2,
        required: true,
        methodIds: ['METHOD.CONTRACT'],
        missingValueRule: 'BLOCK',
        lowerBound: '0',
        upperBound: '100',
        sourceRef: 'S-TZ-001',
      },
    ],
    samplingRules: [
      {
        code: 'SAMPLE.PRIMARY',
        sampleKind: 'PRIMARY',
        required: true,
        retentionDays: 30,
        sealRequired: true,
        custodyRequired: true,
        sourceRef: 'S-TZ-001',
      },
    ],
    documentRequirements: [
      {
        code: organic ? 'DOC.ORGANIC.CERTIFICATE' : 'DOC.QUALITY.PROTOCOL',
        display: { ru: organic ? 'Сертификат органической продукции' : 'Протокол качества' },
        severity: 'BLOCKING',
        signatureKind: 'QUALIFIED',
        releaseBlocking: true,
        sourceRef: 'S-TZ-001',
      },
    ],
    storage: {
      temperatureMin: fresh ? '0' : undefined,
      temperatureMax: fresh ? '8' : undefined,
      humidityMin: undefined,
      humidityMax: undefined,
      shelfLifeHours: fresh ? 168 : undefined,
      packagingKinds: fresh ? ['PALLET'] : ['BULK'],
      palletRequired: fresh,
      blendingMode: organic ? 'PROHIBITED' : 'CONTROLLED',
      sourceRef: 'S-TZ-001',
    },
    acceptance: {
      partialAcceptanceAllowed: true,
      rapidDisputeHours: fresh ? 6 : 48,
      priceDeltaPolicyRef: 'POLICY.QUALITY.DELTA',
      releaseBlockers: ['DOC.QUALITY.PROTOCOL'],
      sourceRef: 'S-TZ-001',
    },
    sourceRefs: ['S-TZ-001'],
    legalRuleIds: organic ? ['L17'] : ['L18'],
  };
}

describe('CommodityProfile domain contract', () => {
  it('validates all six federal crop execution archetypes without crop-specific state branches', () => {
    const versions = COMMODITY_ARCHETYPES.map((archetype, index) => buildCommodityProfileVersion({
      profileId: `profile-${index + 1}`,
      versionId: `version-${index + 1}`,
      sequence: 1,
      state: 'DRAFT',
      createdAt: '2026-07-20T12:00:00Z',
      createdBy: 'owner-1',
      content: profileContent(archetype),
    }));

    expect(versions).toHaveLength(6);
    expect(new Set(versions.map((version) => version.content.archetype))).toEqual(new Set(COMMODITY_ARCHETYPES));
    expect(versions.every((version) => /^[a-f0-9]{64}$/.test(version.contentHash))).toBe(true);
  });

  it('produces the same content hash regardless of object key insertion order', () => {
    const first = profileContent('DRY_BULK');
    const reordered = {
      ...first,
      display: { en: first.display.en, zh: first.display.zh, ru: first.display.ru },
    };
    expect(hashCommodityProfileContent(first)).toBe(hashCommodityProfileContent(reordered));
  });

  it('blocks unknown units, duplicate rules and floating-point authority', () => {
    const unknownUnit = profileContent('SEED_PLANTING');
    unknownUnit.qualityIndicators[0].unitCode = 'UNKNOWN';
    expect(() => buildCommodityProfileVersion({
      profileId: 'p', versionId: 'v', sequence: 1, state: 'DRAFT', createdAt: '2026-07-20T12:00:00Z', createdBy: 'u', content: unknownUnit,
    })).toThrowError(expect.objectContaining({ code: 'PC_PROFILE_UNIT_UNKNOWN' }));

    const invalidDecimal = profileContent('ROOT_INDUSTRIAL');
    invalidDecimal.units[0].numeratorToBase = '0.30000000000000004';
    expect(() => buildCommodityProfileVersion({
      profileId: 'p', versionId: 'v', sequence: 1, state: 'DRAFT', createdAt: '2026-07-20T12:00:00Z', createdBy: 'u', content: invalidDecimal,
    })).toThrowError(expect.objectContaining({ code: 'PC_PROFILE_DECIMAL_INVALID' }));
  });

  it('enforces lifecycle and immutable published content', () => {
    expect(() => assertCommodityProfileTransition('DRAFT', 'EFFECTIVE')).toThrowError(
      expect.objectContaining({ code: 'PC_PROFILE_TRANSITION_DENIED' }),
    );
    expect(() => assertCommodityProfileTransition('REVIEW', 'APPROVED')).not.toThrow();
    expect(() => assertCommodityProfileContentMutable('APPROVED')).toThrowError(
      expect.objectContaining({ code: 'PC_PROFILE_VERSION_IMMUTABLE' }),
    );
    expect(() => assertCommodityProfileContentMutable('DRAFT')).not.toThrow();
  });

  it('prevents two effective versions for the same time window', () => {
    expect(() => assertNoCommodityProfileEffectiveOverlap(
      { versionId: 'candidate', effectiveFrom: '2026-09-01T00:00:00Z' },
      [{
        versionId: 'existing',
        state: 'EFFECTIVE',
        effectiveFrom: '2026-08-01T00:00:00Z',
        effectiveTo: '2026-12-01T00:00:00Z',
      }],
    )).toThrowError(expect.objectContaining({ code: 'PC_PROFILE_EFFECTIVE_OVERLAP' }));
  });

  it('returns stable, explicit error codes for UI and API reason mapping', () => {
    const content = profileContent('DRY_BULK');
    content.documentRequirements[0].severity = 'WARNING';
    try {
      buildCommodityProfileVersion({
        profileId: 'p', versionId: 'v', sequence: 1, state: 'DRAFT', createdAt: '2026-07-20T12:00:00Z', createdBy: 'u', content,
      });
      throw new Error('Expected validation failure');
    } catch (error) {
      expect(error).toBeInstanceOf(CommodityProfileError);
      expect((error as CommodityProfileError).code).toBe('PC_PROFILE_RELEASE_BLOCKER_INVALID');
      expect((error as CommodityProfileError).path).toBe('documentRequirements.0.severity');
    }
  });
});
