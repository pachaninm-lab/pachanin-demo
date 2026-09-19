import { describe, expect, it } from 'vitest';
import {
  platformV7DealDocumentBadgeTone,
  platformV7DealDocumentRequiresSignature,
  platformV7DealDocumentsModel,
  type PlatformV7DealDocument,
} from '@/lib/platform-v7/deal-workspace-documents';

const documents: PlatformV7DealDocument[] = [
  { id: 'd1', kind: 'contract', title: 'Договор', status: 'signed', version: 2, signer: 'Покупатель', updatedAt: '2026-04-25T10:00:00.000Z' },
  { id: 'd2', kind: 'sdiz', title: 'СДИЗ', status: 'missing', version: 1, updatedAt: '2026-04-25T09:00:00.000Z' },
  { id: 'd3', kind: 'quality-protocol', title: 'Протокол качества', status: 'ready', version: 1, signer: 'Лаборатория', updatedAt: '2026-04-25T11:00:00.000Z' },
];

describe('platform-v7 deal workspace documents', () => {
  it('builds document completeness model', () => {
    const model = platformV7DealDocumentsModel(documents);

    expect(model.total).toBe(3);
    expect(model.signed).toBe(1);
    expect(model.missing).toBe(1);
    expect(model.completeness).toBe(33.33);
    expect(model.blocksRelease).toBe(true);
    expect(model.documents.map((document) => document.id)).toEqual(['d3', 'd1', 'd2']);
  });

  it('maps document badge tones', () => {
    expect(platformV7DealDocumentBadgeTone('signed')).toBe('success');
    expect(platformV7DealDocumentBadgeTone('ready')).toBe('warning');
    expect(platformV7DealDocumentBadgeTone('missing')).toBe('danger');
  });

  it('detects documents requiring signature', () => {
    expect(platformV7DealDocumentRequiresSignature(documents[0]!)).toBe(false);
    expect(platformV7DealDocumentRequiresSignature(documents[2]!)).toBe(true);
  });
});
