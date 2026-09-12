import {
  MANUAL_ARTIFACT_FORMATS,
  ManualArtifactFormat,
  ManualFallbackPolicyError,
  isManualArtifactFormat,
  manualProofStatusKey,
  projectManualProofFacts,
  validateManualExportArtifact,
  type ManualProofFacts,
} from './manual-integration-fallback.policy';

const emptyFacts = (): ManualProofFacts => ({
  exportedAt: null,
  sentEvidenceAt: null,
  manualEvidenceAt: null,
  providerConfirmedAt: null,
  createdInOneCAt: null,
  postedInOneCAt: null,
});

describe('manual integration fallback', () => {
  it('pins the exact allowed export/import artifact formats', () => {
    expect(MANUAL_ARTIFACT_FORMATS).toEqual([
      'XML',
      'PDF',
      'CSV',
      'XLSX',
      'CANONICAL_JSON',
      'EVIDENCE_ZIP',
    ]);
  });

  it('refuses an invented artifact format', () => {
    expect(isManualArtifactFormat('DB_DUMP')).toBe(false);
  });

  it('accepts a version-bound, hash-bound export artifact', () => {
    expect(() =>
      validateManualExportArtifact({
        sourceDocumentId: 'doc-1',
        sourceDocumentVersionId: 'version-3',
        format: ManualArtifactFormat.XML,
        payloadHash: 'a'.repeat(64),
        fileName: 'upd-1.xml',
        createdAt: new Date('2026-08-18T18:00:00Z'),
      }),
    ).not.toThrow();
  });

  it('refuses an export without exact document version or SHA-256 evidence', () => {
    expect(() =>
      validateManualExportArtifact({
        sourceDocumentId: 'doc-1',
        sourceDocumentVersionId: '',
        format: ManualArtifactFormat.PDF,
        payloadHash: 'a'.repeat(64),
        fileName: 'upd-1.pdf',
        createdAt: new Date(),
      }),
    ).toThrow('sourceDocumentVersionId is required');

    expect(() =>
      validateManualExportArtifact({
        sourceDocumentId: 'doc-1',
        sourceDocumentVersionId: 'version-3',
        format: ManualArtifactFormat.PDF,
        payloadHash: 'not-a-hash',
        fileName: 'upd-1.pdf',
        createdAt: new Date(),
      }),
    ).toThrow('payloadHash must be a SHA-256 hex digest');
  });

  it('keeps EXPORTED distinct from SENT', () => {
    const projection = projectManualProofFacts({
      ...emptyFacts(),
      exportedAt: new Date('2026-08-18T18:00:00Z'),
    });

    expect(projection.exported).toBe(true);
    expect(projection.sentEvidence).toBe(false);
    expect(projection.providerConfirmed).toBe(false);
    expect(manualProofStatusKey(projection)).toBe('EXPORTED');
  });

  it('keeps manual sent evidence distinct from provider confirmation', () => {
    const projection = projectManualProofFacts({
      ...emptyFacts(),
      exportedAt: new Date('2026-08-18T18:00:00Z'),
      sentEvidenceAt: new Date('2026-08-18T18:05:00Z'),
      manualEvidenceAt: new Date('2026-08-18T18:06:00Z'),
    });

    expect(projection.sentEvidence).toBe(true);
    expect(projection.manualEvidence).toBe(true);
    expect(projection.providerConfirmed).toBe(false);
    expect(manualProofStatusKey(projection)).toBe('MANUAL_EVIDENCE');
  });

  it('does not let manual evidence become PROVIDER_CONFIRMED by implication', () => {
    const projection = projectManualProofFacts({
      ...emptyFacts(),
      manualEvidenceAt: new Date('2026-08-18T18:06:00Z'),
    });

    expect(projection.manualEvidence).toBe(true);
    expect(projection.providerConfirmed).toBe(false);
  });

  it('keeps CREATED_IN_1C distinct from POSTED', () => {
    const projection = projectManualProofFacts({
      ...emptyFacts(),
      createdInOneCAt: new Date('2026-08-18T18:10:00Z'),
    });

    expect(projection.createdInOneC).toBe(true);
    expect(projection.postedInOneC).toBe(false);
    expect(manualProofStatusKey(projection)).toBe('CREATED_IN_1C');
  });

  it('shows POSTED_IN_1C only when posting has its own evidence', () => {
    const projection = projectManualProofFacts({
      ...emptyFacts(),
      createdInOneCAt: new Date('2026-08-18T18:10:00Z'),
      postedInOneCAt: new Date('2026-08-18T18:12:00Z'),
    });

    expect(projection.postedInOneC).toBe(true);
    expect(manualProofStatusKey(projection)).toBe('POSTED_IN_1C');
  });

  it('shows provider confirmation only when that fact has its own evidence', () => {
    const projection = projectManualProofFacts({
      ...emptyFacts(),
      exportedAt: new Date('2026-08-18T18:00:00Z'),
      providerConfirmedAt: new Date('2026-08-18T18:20:00Z'),
    });

    expect(projection.providerConfirmed).toBe(true);
    expect(manualProofStatusKey(projection)).toBe('PROVIDER_CONFIRMED');
  });

  it('reports NO_EVIDENCE when nothing has been proven', () => {
    expect(manualProofStatusKey(projectManualProofFacts(emptyFacts()))).toBe(
      'NO_EVIDENCE',
    );
  });

  it('fails closed on malformed timestamps instead of silently projecting proof', () => {
    expect(() =>
      projectManualProofFacts({
        ...emptyFacts(),
        providerConfirmedAt: new Date(Number.NaN),
      }),
    ).toThrow(ManualFallbackPolicyError);
  });
});
