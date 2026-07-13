import { describe, expect, it } from 'vitest';
import {
  buildDocumentBasisProjection,
  type CanonicalDealDocumentWorkspace,
  type DealDocumentAuthority,
} from '../../lib/deal-document-basis-server';

const DEAL_ID = 'deal-document-authority';
const TENANT_ID = 'tenant-document-authority';
const SHIPMENT_ID = 'shipment-document-authority';
const ACCEPTANCE_ID = 'acceptance-document-authority';
const LAB_ID = 'lab-document-authority';

function document(
  type: DealDocumentAuthority['type'],
  overrides: Partial<DealDocumentAuthority> = {},
): DealDocumentAuthority {
  return {
    id: `${type}-document`,
    dealId: DEAL_ID,
    tenantId: TENANT_ID,
    type,
    status: 'SIGNED',
    name: `${type}.pdf`,
    hash: 'a'.repeat(64),
    signedAt: '2026-07-13T10:00:00.000Z',
    bankRequired: type === 'bank_basis',
    releaseRequired: true,
    bankAcceptance: type === 'bank_basis' ? 'ACCEPTED' : 'PENDING',
    edoStatus: 'CONFIRMED',
    edoExternalId: `edo-${type}`,
    version: 1,
    isImmutable: true,
    sourceFileId: `source-${type}`,
    signatureFileId: `signature-${type}`,
    supersedesId: null,
    seriesId: `series-${type}`,
    uploadedAt: '2026-07-13T10:00:00.000Z',
    ...overrides,
  };
}

function workspace(
  documents: DealDocumentAuthority[] = canonicalDocuments(),
): CanonicalDealDocumentWorkspace {
  return {
    deal: {
      id: DEAL_ID,
      tenantId: TENANT_ID,
      version: '17',
      status: 'ACCEPTED',
      lotId: 'lot-document-authority',
      sourceLotId: null,
      shipments: [{
        id: SHIPMENT_ID,
        dealId: DEAL_ID,
        tenantId: TENANT_ID,
        status: 'ARRIVED',
      }],
      acceptanceRecords: [{
        id: ACCEPTANCE_ID,
        dealId: DEAL_ID,
        shipmentId: SHIPMENT_ID,
        status: 'ACCEPTED',
        qualityStatus: 'PASSED',
        actDocId: 'acceptance_act-document',
        actSignedAt: '2026-07-13T10:00:00.000Z',
      }],
      labSamples: [{
        id: LAB_ID,
        dealId: DEAL_ID,
        shipmentId: SHIPMENT_ID,
        acceptanceId: ACCEPTANCE_ID,
        tenantId: TENANT_ID,
        status: 'DONE',
        finalizedAt: '2026-07-13T09:00:00.000Z',
        certificateDocId: 'quality_certificate-document',
        tests: [{ id: 'test-document-authority', passed: true }],
      }],
    },
    viewer: {
      participantId: 'participant-document-authority',
      organizationId: 'org-document-authority',
      role: 'BUYER',
      accessLevel: 'WORK',
    },
    documents,
  };
}

function canonicalDocuments(): DealDocumentAuthority[] {
  return [
    document('contract'),
    document('sdiz'),
    document('transport_waybill'),
    document('lab_protocol'),
    document('quality_certificate'),
    document('acceptance_act'),
    document('bank_basis'),
  ];
}

describe('canonical Deal document-basis projection', () => {
  it('opens bank review only after the complete authoritative pre-bank package', () => {
    const projection = buildDocumentBasisProjection(workspace(), SHIPMENT_ID);

    expect(projection).toMatchObject({
      dealId: DEAL_ID,
      tenantId: TENANT_ID,
      shipmentId: SHIPMENT_ID,
      documentsReady: true,
      bankBasisReady: true,
      blockers: [],
    });
    expect(projection?.items.every((item) => item.status === 'ready')).toBe(true);
  });

  it('fails closed when an obligatory document is absent', () => {
    const documents = canonicalDocuments().filter((item) => item.type !== 'contract');
    const projection = buildDocumentBasisProjection(workspace(documents), SHIPMENT_ID);

    expect(projection?.documentsReady).toBe(false);
    expect(projection?.blockers).toContain('DOCUMENT_CONTRACT_MISSING');
    expect(projection?.items.find((item) => item.kind === 'contract')).toMatchObject({
      status: 'required',
      document: null,
    });
  });

  it('rejects acceptance and quality documents that do not match persisted execution facts', () => {
    const authority = workspace();
    authority.deal.acceptanceRecords[0] = {
      ...authority.deal.acceptanceRecords[0],
      actDocId: 'different-acceptance-act',
    };
    authority.deal.labSamples[0] = {
      ...authority.deal.labSamples[0],
      certificateDocId: 'different-quality-certificate',
    };

    const projection = buildDocumentBasisProjection(authority, SHIPMENT_ID);

    expect(projection?.documentsReady).toBe(false);
    expect(projection?.blockers).toEqual(expect.arrayContaining([
      'ACCEPTANCE_ACT_DOCUMENT_MISMATCH',
      'QUALITY_CERTIFICATE_DOCUMENT_MISMATCH',
    ]));
  });

  it('uses the latest document version and does not fall back to an older signed version', () => {
    const documents = canonicalDocuments();
    documents.push(document('contract', {
      id: 'contract-document-v2',
      version: 2,
      status: 'PENDING_REVIEW',
      signedAt: null,
      uploadedAt: '2026-07-13T11:00:00.000Z',
    }));

    const projection = buildDocumentBasisProjection(workspace(documents), SHIPMENT_ID);
    const contract = projection?.items.find((item) => item.kind === 'contract');

    expect(contract?.document?.id).toBe('contract-document-v2');
    expect(contract?.status).toBe('review');
    expect(projection?.documentsReady).toBe(false);
    expect(projection?.blockers).toContain('DOCUMENT_CONTRACT_NOT_AUTHORITATIVE');
  });

  it('does not confuse pre-bank package readiness with bank confirmation', () => {
    const documents = canonicalDocuments().filter((item) => item.type !== 'bank_basis');
    const projection = buildDocumentBasisProjection(workspace(documents), SHIPMENT_ID);

    expect(projection?.documentsReady).toBe(true);
    expect(projection?.bankBasisReady).toBe(false);
    expect(projection?.items.find((item) => item.kind === 'bank_basis')?.status).toBe('required');
    expect(projection?.blockers).not.toContain('DOCUMENT_BANK_BASIS_MISSING');
  });
});
