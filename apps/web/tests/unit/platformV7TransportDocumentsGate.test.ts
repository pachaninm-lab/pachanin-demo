import { describe, expect, it } from 'vitest';
import type { PlatformV7TransportDocumentsGateInput } from '@/lib/platform-v7/logistics-transport-documents-gate';
import {
  platformV7TransportDocumentIsComplete,
  platformV7TransportDocumentsBlockers,
  platformV7TransportDocumentsGateModel,
  platformV7TransportDocumentsGateStatus,
  platformV7TransportDocumentsGateTone,
  platformV7TransportDocumentsMoneyImpact,
  platformV7TransportDocumentsNextAction,
  platformV7TransportDocumentsReviewReasons,
} from '@/lib/platform-v7/logistics-transport-documents-gate';

const completePack: PlatformV7TransportDocumentsGateInput = {
  packId: 'TDP-1',
  dealId: 'DL-1',
  shipmentId: 'SHIP-1',
  provider: 'SBER_KORUS',
  gisEpdRequired: true,
  providerCallbackReceived: true,
  manualHold: false,
  documents: [
    {
      kind: 'etrn',
      status: 'registered',
      required: true,
      gisStatus: 'registered',
      signatureStatuses: ['signed', 'signed', 'signed'],
    },
    {
      kind: 'transport_request',
      status: 'completed',
      required: true,
      gisStatus: 'not_required',
      signatureStatuses: ['signed', 'signed'],
    },
  ],
};

describe('platform-v7 transport documents gate', () => {
  it('allows release only when required transport documents are complete', () => {
    const model = platformV7TransportDocumentsGateModel(completePack);

    expect(model.status).toBe('ready');
    expect(model.tone).toBe('success');
    expect(model.moneyImpact).toBe('release_allowed');
    expect(model.canReleaseMoney).toBe(true);
    expect(model.readinessPercent).toBe(100);
    expect(model.blockers).toEqual([]);
  });

  it('blocks release when provider callback or GIS registration is missing', () => {
    const model = platformV7TransportDocumentsGateModel({
      ...completePack,
      providerCallbackReceived: false,
      documents: [
        {
          kind: 'etrn',
          status: 'fully_signed',
          required: true,
          gisStatus: 'pending',
          signatureStatuses: ['signed', 'signed'],
        },
      ],
    });

    expect(model.status).toBe('blocked');
    expect(model.moneyImpact).toBe('hold');
    expect(model.blockers).toContain('provider-callback-missing');
    expect(model.blockers).toContain('etrn:not-registered-in-gis-epd');
  });

  it('blocks failed signatures and declined documents', () => {
    const model = platformV7TransportDocumentsGateModel({
      ...completePack,
      documents: [
        {
          kind: 'transport_request',
          status: 'declined',
          required: true,
          gisStatus: 'not_required',
          signatureStatuses: ['signed', 'failed'],
        },
      ],
    });

    expect(model.status).toBe('blocked');
    expect(model.blockers).toContain('transport_request:declined');
    expect(model.blockers).toContain('transport_request:signature-failed');
  });

  it('routes signed but not registered documents to review', () => {
    const model = platformV7TransportDocumentsGateModel({
      ...completePack,
      gisEpdRequired: false,
      documents: [
        {
          kind: 'transport_request',
          status: 'fully_signed',
          required: true,
          gisStatus: 'not_required',
          signatureStatuses: ['signed', 'signed'],
        },
      ],
    });

    expect(model.status).toBe('review');
    expect(model.moneyImpact).toBe('hold');
    expect(model.reviewReasons).toContain('transport_request:fully_signed');
  });

  it('keeps helper outputs deterministic', () => {
    expect(platformV7TransportDocumentsBlockers(completePack)).toEqual([]);
    expect(platformV7TransportDocumentsReviewReasons(completePack)).toEqual([]);
    expect(platformV7TransportDocumentIsComplete(completePack.documents[0])).toBe(true);
    expect(platformV7TransportDocumentsGateStatus([], [])).toBe('ready');
    expect(platformV7TransportDocumentsMoneyImpact('ready', 100)).toBe('release_allowed');
    expect(platformV7TransportDocumentsGateTone('blocked')).toBe('danger');
    expect(platformV7TransportDocumentsNextAction('ready', [], [])).toBe('Транспортные документы закрыты, документный блокер снят.');
  });
});
