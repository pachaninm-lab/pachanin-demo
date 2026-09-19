import { describe, expect, it } from 'vitest';
import {
  collectCommodityProfilePages,
  parseCommodityProfileHistory,
  parseCommodityProfilePage,
  withCommodityProfileHistory,
} from '../../components/crop-platform/commodity-profile-live-adapter';

const profile = {
  id: 'profile-wheat-1',
  canonicalCode: 'WHEAT.CLASS.3',
  archetype: 'DRY_BULK',
  authoritativeNameRu: 'Пшеница 3 класса',
  displayNameEn: 'Class 3 wheat',
  displayNameZh: '三等小麦',
  classification: 'INTERNAL',
  version: '7',
  updatedAt: '2026-07-21T10:00:00.000Z',
  updatedByUserId: 'staff-user-1',
  selectedVersion: {
    id: 'profile-version-7',
    sequence: 7,
    lifecycle: 'APPROVED',
    sourceStatus: 'VERIFIED',
    effectiveFrom: null,
    effectiveTo: null,
    contentHash: 'a'.repeat(64),
    updatedByUserId: 'compliance-user-1',
    content: {
      display: { ru: 'Пшеница 3 класса', en: 'Class 3 wheat', zh: '三等小麦' },
      purpose: 'Продовольственная поставка',
      qualityIndicators: [{
        code: 'PROTEIN',
        display: { ru: 'Белок', en: 'Protein' },
        unitCode: 'PERCENT',
        required: true,
        methodIds: ['GOST-10846'],
      }],
      documentRequirements: [{
        code: 'QUALITY_CERTIFICATE',
        display: { ru: 'Удостоверение качества' },
        releaseBlocking: true,
        signatureKind: 'QUALIFIED',
        registry: 'FGIS_GRAIN',
      }],
      storage: {
        temperatureMin: '-10',
        temperatureMax: '25',
        humidityMin: '10',
        humidityMax: '75',
        shelfLifeHours: 720,
        packagingKinds: ['BULK'],
        blendingMode: 'CONTROLLED',
      },
      acceptance: {
        partialAcceptanceAllowed: false,
        rapidDisputeHours: 24,
        releaseBlockers: ['QUALITY_CERTIFICATE'],
      },
      sourceRefs: ['source:quality-standard'],
      legalRuleIds: ['rule:grain-quality'],
    },
  },
  actions: [],
  primaryAction: {
    id: 'ACTIVATE',
    allowed: false,
    reasonCode: 'JIT_AUTHORITY_REQUIRED',
    requiresConfirmation: true,
    owner: 'COMPLIANCE',
    impact: 'HIGH',
  },
};

const secondProfile = {
  ...profile,
  id: 'profile-barley-1',
  canonicalCode: 'BARLEY.FOOD',
  authoritativeNameRu: 'Ячмень продовольственный',
  displayNameEn: 'Food barley',
  displayNameZh: '食用大麦',
  version: '3',
  selectedVersion: {
    ...profile.selectedVersion,
    id: 'profile-version-barley-3',
    sequence: 3,
    contentHash: 'b'.repeat(64),
  },
};

describe('commodity profile live adapter', () => {
  it('maps only authoritative server fields and server-selected action', () => {
    const parsed = parseCommodityProfilePage({ items: [profile], nextCursor: null }, 'ru');
    expect(parsed).not.toBeNull();
    expect(parsed?.items).toHaveLength(1);
    expect(parsed?.items[0]).toMatchObject({
      id: profile.id,
      canonicalCode: profile.canonicalCode,
      state: 'APPROVED',
      versionId: 'profile-version-7',
      sequence: 7,
      updatedBy: 'compliance-user-1',
      sourceStatus: 'VERIFIED',
      pinnedDealCount: 0,
      primaryAction: {
        code: 'ACTIVATE',
        disabled: true,
        owner: 'COMPLIANCE',
        impact: 'HIGH',
      },
    });
    expect(parsed?.items[0]?.qualityIndicators[0]).toMatchObject({
      code: 'PROTEIN',
      unitCode: 'PERCENT',
      methodCount: 1,
    });
  });

  it('omits a valid versionless aggregate without invalidating valid rows', () => {
    const versionless = {
      ...profile,
      id: 'profile-versionless-1',
      canonicalCode: 'WHEAT.VERSIONLESS',
      version: '1',
      selectedVersion: null,
    };
    const parsed = parseCommodityProfilePage({
      items: [versionless, profile],
      nextCursor: null,
    }, 'ru');
    expect(parsed?.items.map((item) => item.id)).toEqual([profile.id]);
  });

  it('rejects malformed non-null selected versions', () => {
    expect(parseCommodityProfilePage({
      items: [{ ...profile, selectedVersion: 'malformed' }],
      nextCursor: null,
    }, 'ru')).toBeNull();
  });

  it('rejects incomplete content instead of manufacturing defaults', () => {
    const invalid = structuredClone(profile);
    delete (invalid.selectedVersion.content as Partial<typeof profile.selectedVersion.content>).storage;
    expect(parseCommodityProfilePage({ items: [invalid], nextCursor: null }, 'ru')).toBeNull();
  });

  it('rejects missing authoritative actor and invalid content hash', () => {
    expect(parseCommodityProfilePage({
      items: [{ ...profile, updatedByUserId: '' }],
      nextCursor: null,
    }, 'ru')).toBeNull();
    expect(parseCommodityProfilePage({
      items: [{
        ...profile,
        selectedVersion: { ...profile.selectedVersion, contentHash: 'not-a-digest' },
      }],
      nextCursor: null,
    }, 'ru')).toBeNull();
  });

  it('collects all pages and deterministically deduplicates identical records', async () => {
    const cursors: Array<string | null> = [];
    const records = await collectCommodityProfilePages(async (cursor) => {
      cursors.push(cursor);
      if (cursor === null) return { items: [profile], nextCursor: 'cursor-2' };
      if (cursor === 'cursor-2') return { items: [profile, secondProfile], nextCursor: null };
      throw new Error('unexpected cursor');
    }, 'ru');

    expect(cursors).toEqual([null, 'cursor-2']);
    expect(records?.map((item) => item.id)).toEqual([profile.id, secondProfile.id]);
  });

  it('fails closed on a conflicting duplicate or invalid later page', async () => {
    const conflicting = { ...profile, canonicalCode: 'WHEAT.CONFLICTING' };
    await expect(collectCommodityProfilePages(async (cursor) => cursor === null
      ? { items: [profile], nextCursor: 'next' }
      : { items: [conflicting], nextCursor: null }, 'ru')).resolves.toBeNull();

    await expect(collectCommodityProfilePages(async (cursor) => cursor === null
      ? { items: [profile], nextCursor: 'next' }
      : { items: 'invalid', nextCursor: null }, 'ru')).resolves.toBeNull();
  });

  it('fails closed on cursor cycles and hard page or item bounds', async () => {
    await expect(collectCommodityProfilePages(async (cursor) => cursor === null
      ? { items: [profile], nextCursor: 'cycle' }
      : { items: [secondProfile], nextCursor: 'cycle' }, 'ru')).resolves.toBeNull();

    await expect(collectCommodityProfilePages(async () => ({
      items: [profile],
      nextCursor: 'more',
    }), 'ru', { maxPages: 1 })).resolves.toBeNull();

    await expect(collectCommodityProfilePages(async () => ({
      items: [profile, secondProfile],
      nextCursor: null,
    }), 'ru', { maxItems: 1 })).resolves.toBeNull();
  });

  it('binds authoritative history actors and reasons to the selected record', () => {
    const page = parseCommodityProfilePage({ items: [profile], nextCursor: null }, 'en');
    const history = parseCommodityProfileHistory({
      profileId: profile.id,
      aggregateVersion: '7',
      nextCursor: null,
      items: [{
        lifecycle: 'APPROVED',
        approvedByUserId: 'compliance-user-1',
        approvedAt: '2026-07-21T09:59:00.000Z',
        approvalReason: 'Verified quality and provenance.',
        updatedByUserId: 'compliance-user-1',
        updatedAt: '2026-07-21T10:00:00.000Z',
      }],
    });
    expect(page).not.toBeNull();
    expect(history).not.toBeNull();
    const records = withCommodityProfileHistory(page!.items, history!);
    expect(records[0]?.approvalTrail).toEqual([{
      state: 'APPROVED',
      actor: 'compliance-user-1',
      occurredAt: '2026-07-21T09:59:00.000Z',
      reason: 'Verified quality and provenance.',
    }]);
  });
});
