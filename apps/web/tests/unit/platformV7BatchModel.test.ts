import { describe, expect, it } from 'vitest';
import { canPlatformV7BatchPublish, isPlatformV7BatchVolumeBalanced, type PlatformV7GrainBatch } from '@/lib/platform-v7/batch-model';

const baseBatch: PlatformV7GrainBatch = {
  id: 'batch-1',
  ownerId: 'seller-1',
  crop: 'Пшеница',
  class: '4',
  harvestYear: 2025,
  totalTons: 600,
  availableTons: 400,
  reservedTons: 100,
  soldTons: 100,
  region: 'Тамбовская область',
  storageLocation: 'Элеватор',
  storageType: 'elevator',
  fgisStatus: 'confirmed',
  sdizStatus: 'ready_to_sign',
  qualityStatus: 'declared',
  documentStatus: 'partial',
  readinessScore: 82,
  blockers: [],
  createdAt: '2026-05-06T10:00:00.000Z',
  updatedAt: '2026-05-06T10:00:00.000Z',
};

describe('platform-v7 batch model', () => {
  it('keeps available, reserved and sold tons inside total batch volume', () => {
    expect(isPlatformV7BatchVolumeBalanced(baseBatch)).toBe(true);
    expect(isPlatformV7BatchVolumeBalanced({ ...baseBatch, reservedTons: 300, soldTons: 200 })).toBe(false);
  });

  it('allows publication only when readiness is high and no critical blocker exists', () => {
    expect(canPlatformV7BatchPublish(baseBatch)).toBe(true);
    expect(canPlatformV7BatchPublish({ ...baseBatch, readinessScore: 70 })).toBe(false);
    expect(
      canPlatformV7BatchPublish({
        ...baseBatch,
        blockers: [
          {
            id: 'blocker-1',
            title: 'Нет СДИЗ',
            reason: 'Нельзя отгружать без документа',
            responsibleRole: 'seller',
            blocks: 'shipment',
            severity: 'critical',
            createdAt: '2026-05-06T10:00:00.000Z',
          },
        ],
      })
    ).toBe(false);
  });
});
