import { describe, expect, it } from 'vitest';
import { calculatePlatformV7DealFinancialTerms } from '@/lib/platform-v7/deal-financial-terms';
import { platformV7DealDocumentsModel, type PlatformV7DealDocument } from '@/lib/platform-v7/deal-workspace-documents';
import { platformV7DealLogisticsModel, type PlatformV7DealLogisticsTrip } from '@/lib/platform-v7/deal-workspace-logistics';
import {
  platformV7DealReleaseReadinessModel,
  platformV7DealReleaseReadinessTone,
} from '@/lib/platform-v7/deal-workspace-release-readiness';

const signedDocuments: PlatformV7DealDocument[] = [
  { id: 'd1', kind: 'contract', title: 'Договор', status: 'signed', version: 1, updatedAt: '2026-04-25T10:00:00.000Z' },
  { id: 'd2', kind: 'sdiz', title: 'СДИЗ', status: 'signed', version: 1, updatedAt: '2026-04-25T11:00:00.000Z' },
];

const acceptedTrip: PlatformV7DealLogisticsTrip = {
  id: 'TR-1',
  carrier: 'Перевозчик',
  driver: 'Водитель',
  vehicle: 'truck-1',
  status: 'accepted',
  blockers: [],
  ettnStatus: 'signed',
};

describe('platform-v7 deal release readiness', () => {
  it('passes all gates when documents logistics money bank and dispute are clean', () => {
    const model = platformV7DealReleaseReadinessModel({
      documents: platformV7DealDocumentsModel(signedDocuments),
      logistics: platformV7DealLogisticsModel(acceptedTrip),
      financialTerms: calculatePlatformV7DealFinancialTerms({ pricePerTon: 10000, volumeTons: 10, vatRate: 10, basis: 'EXW' }),
      bankCallbackConfirmed: true,
      disputeOpen: false,
    });

    expect(model.canRelease).toBe(true);
    expect(model.gateStatus).toBe('pass');
    expect(model.blockerCount).toBe(0);
    expect(model.nextAction).toBe('Выпустить деньги');
    expect(platformV7DealReleaseReadinessTone(model)).toBe('success');
  });

  it('fails release when documents and dispute block the deal', () => {
    const model = platformV7DealReleaseReadinessModel({
      documents: platformV7DealDocumentsModel([{ ...signedDocuments[0]!, status: 'missing' }]),
      logistics: platformV7DealLogisticsModel(acceptedTrip),
      financialTerms: calculatePlatformV7DealFinancialTerms({ pricePerTon: 10000, volumeTons: 10, vatRate: 10, basis: 'EXW' }),
      bankCallbackConfirmed: true,
      disputeOpen: true,
    });

    expect(model.canRelease).toBe(false);
    expect(model.gateStatus).toBe('fail');
    expect(model.blockerCount).toBe(2);
    expect(model.nextAction).toBe('Документы');
    expect(platformV7DealReleaseReadinessTone(model)).toBe('danger');
  });

  it('marks readiness as review while waiting for bank callback', () => {
    const model = platformV7DealReleaseReadinessModel({
      documents: platformV7DealDocumentsModel(signedDocuments),
      logistics: platformV7DealLogisticsModel(acceptedTrip),
      financialTerms: calculatePlatformV7DealFinancialTerms({ pricePerTon: 10000, volumeTons: 10, vatRate: 10, basis: 'EXW' }),
      bankCallbackConfirmed: false,
      disputeOpen: false,
    });

    expect(model.canRelease).toBe(false);
    expect(model.gateStatus).toBe('review');
    expect(platformV7DealReleaseReadinessTone(model)).toBe('warning');
  });
});
