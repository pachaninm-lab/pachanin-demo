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
  type CommodityProfileContentHasher,
} from './commodity-profile';

const TEST_SHA256: CommodityProfileContentHasher = (canonicalJson) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonicalJson.length; index += 1) {
    hash ^= canonicalJson.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').repeat(8);
};

function profileContent(archetype: CommodityArchetype): CommodityProfileContent {
  const fresh = archetype === 'FRESH_PACKED' || archetype === 'GREENHOUSE_RECURRING';
  const organic = archetype === 'ORGANIC_EXPORT_QUARANTINE';
  const documentCode = organic ? 'DOC.ORGANIC.CERTIFICATE' : 'DOC.QUALITY.PROTOCOL';
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
      ...(fresh
        ? [{
            code: 'CEL',
            dimension: 'TEMPERATURE' as const,
            symbol: '°C',
            isBase: true,
            precision: 2,
            numeratorToBase: '1',
            denominatorToBase: '1',
            sourceRef: 'S-TZ-001',
          }]
        : []),
    ],
    qualityIndicators: [
      {
        code: fresh ? 'TEMPERATURE' : 'MOISTURE',
        display: { ru: fresh ? 'Температура' : 'Влажность' },
        unitCode: fresh ? 'CEL' : 'PCT',
        precision: 2,
        required: true,
        methodIds: ['METHOD.CONTRACT'],
        missingValueRule: 'BLOCK',
        lowerBound: '0',
        upperBound: fresh ? '8' : '100',
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
        code: documentCode,
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
      releaseBlockers: [documentCode],
      sourceRef: 'S-TZ-001',
    },
    sourceRefs: ['S-TZ-001'],
    legalRuleIds: organic ? ['L17'] : ['L18'],
  };
}

function versionInput(archetype: CommodityArchetype = 'DRY_BULK') {
  return {
    profileId: 'profile-1',
    versionId: 'version-1',
    sequence: 1,
    state: 'DRAFT' as const,
    createdAt: '2026-07-20T12:00:00Z',
    createdBy: 'owner-1',
    content: profileContent(archetype),
  };
}

function captureProfileError(action: () => unknown): CommodityProfileError {
  try {
    action();
    throw new Error('Expected CommodityProfileError');
  } catch (error) {
    expect(error).toBeInstanceOf(CommodityProfileError);
    return error as CommodityProfileError;
  }
}

describe('CommodityProfile domain contract', () => {
  it('validates all six federal crop execution archetypes without crop-specific state branches', () => {
    const versions = COMMODITY_ARCHETYPES.map((archetype, index) =>
      buildCommodityProfileVersion({
        ...versionInput(archetype),
        profileId: `profile-${index + 1}`,
        versionId: `version-${index + 1}`,
      }, TEST_SHA256),
    );

    expect(versions).toHaveLength(6);
    expect(new Set(versions.map((version) => version.content.archetype))).toEqual(new Set(COMMODITY_ARCHETYPES));
    expect(versions.every((version) => version.contentHashAlgorithm === 'SHA-256')).toBe(true);
    expect(versions.every((version) => /^[a-f0-9]{64}$/.test(version.contentHash))).toBe(true);
  });

  it('produces the same hash for semantically identical set ordering', () => {
    const first = profileContent('DRY_BULK');
    const reordered = structuredClone(first);
    reordered.display = { en: first.display.en, zh: first.display.zh, ru: first.display.ru };
    reordered.units.reverse();
    reordered.sourceRefs.reverse();
    expect(hashCommodityProfileContent(first, TEST_SHA256)).toBe(
      hashCommodityProfileContent(reordered, TEST_SHA256),
    );
  });

  it('rejects a crypto adapter that does not return canonical SHA-256 hex', () => {
    const error = captureProfileError(() => buildCommodityProfileVersion(
      versionInput(),
      () => 'not-a-sha256-digest',
    ));
    expect(error.code).toBe('PC_PROFILE_HASH_INVALID');
    expect(error.path).toBe('contentHash');
  });

  it('deep-freezes the accepted version so nested published facts cannot drift in memory', () => {
    const version = buildCommodityProfileVersion(versionInput(), TEST_SHA256);
    expect(Object.isFrozen(version)).toBe(true);
    expect(Object.isFrozen(version.content)).toBe(true);
    expect(Object.isFrozen(version.content.units)).toBe(true);
    expect(Object.isFrozen(version.content.units[0])).toBe(true);
  });

  it('blocks unknown units and floating-point authority', () => {
    const unknownUnit = profileContent('SEED_PLANTING');
    unknownUnit.qualityIndicators[0].unitCode = 'UNKNOWN';
    expect(captureProfileError(() => buildCommodityProfileVersion({
      ...versionInput('SEED_PLANTING'), content: unknownUnit,
    }, TEST_SHA256)).code).toBe('PC_PROFILE_UNIT_UNKNOWN');

    const invalidDecimal = profileContent('ROOT_INDUSTRIAL');
    invalidDecimal.units[0].numeratorToBase = '0.30000000000000004';
    expect(captureProfileError(() => buildCommodityProfileVersion({
      ...versionInput('ROOT_INDUSTRIAL'), content: invalidDecimal,
    }, TEST_SHA256)).code).toBe('PC_PROFILE_DECIMAL_INVALID');
  });

  it('requires one base unit per represented dimension and ordered bounds', () => {
    const missingBase = profileContent('DRY_BULK');
    missingBase.units[1].isBase = false;
    expect(captureProfileError(() => buildCommodityProfileVersion({
      ...versionInput(), content: missingBase,
    }, TEST_SHA256)).code).toBe('PC_PROFILE_BASE_UNIT_INVALID');

    const invalidRange = profileContent('FRESH_PACKED');
    invalidRange.storage.temperatureMin = '9';
    invalidRange.storage.temperatureMax = '8';
    expect(captureProfileError(() => buildCommodityProfileVersion({
      ...versionInput('FRESH_PACKED'), content: invalidRange,
    }, TEST_SHA256)).code).toBe('PC_PROFILE_RANGE_INVALID');
  });

  it('requires release blockers to reference declared document requirements', () => {
    const content = profileContent('ORGANIC_EXPORT_QUARANTINE');
    content.acceptance.releaseBlockers = ['DOC.UNKNOWN'];
    const error = captureProfileError(() => buildCommodityProfileVersion({
      ...versionInput('ORGANIC_EXPORT_QUARANTINE'), content,
    }, TEST_SHA256));
    expect(error.code).toBe('PC_PROFILE_BLOCKER_REFERENCE_UNKNOWN');
    expect(error.path).toBe('acceptance.releaseBlockers.0');
  });

  it('enforces lifecycle and immutable published content', () => {
    expect(captureProfileError(() => assertCommodityProfileTransition('DRAFT', 'EFFECTIVE')).code).toBe(
      'PC_PROFILE_TRANSITION_DENIED',
    );
    expect(() => assertCommodityProfileTransition('REVIEW', 'APPROVED')).not.toThrow();
    expect(captureProfileError(() => assertCommodityProfileContentMutable('APPROVED')).code).toBe(
      'PC_PROFILE_VERSION_IMMUTABLE',
    );
    expect(() => assertCommodityProfileContentMutable('DRAFT')).not.toThrow();
  });

  it('requires approval evidence before a version can become effective', () => {
    const error = captureProfileError(() => buildCommodityProfileVersion({
      ...versionInput(),
      state: 'EFFECTIVE',
      effectiveFrom: '2026-09-01T00:00:00Z',
    }, TEST_SHA256));
    expect(error.code).toBe('PC_PROFILE_APPROVAL_EVIDENCE_REQUIRED');
  });

  it('prevents two effective versions for the same time window', () => {
    const error = captureProfileError(() => assertNoCommodityProfileEffectiveOverlap(
      { versionId: 'candidate', effectiveFrom: '2026-09-01T00:00:00Z' },
      [{
        versionId: 'existing',
        state: 'EFFECTIVE',
        effectiveFrom: '2026-08-01T00:00:00Z',
        effectiveTo: '2026-12-01T00:00:00Z',
      }],
    ));
    expect(error.code).toBe('PC_PROFILE_EFFECTIVE_OVERLAP');
  });

  it('returns stable reason codes for API and interface mapping', () => {
    const content = profileContent('DRY_BULK');
    content.documentRequirements[0].severity = 'WARNING';
    const error = captureProfileError(() => buildCommodityProfileVersion({
      ...versionInput(), content,
    }, TEST_SHA256));
    expect(error.code).toBe('PC_PROFILE_RELEASE_BLOCKER_INVALID');
    expect(error.path).toBe('documentRequirements.0.severity');
  });
});
