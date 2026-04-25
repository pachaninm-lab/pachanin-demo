import { describe, expect, it } from 'vitest';
import type { PlatformV7EvidenceLedgerEntry } from '@/lib/platform-v7/evidence-ledger';
import {
  platformV7DisputeEvidenceMissingClasses,
  platformV7DisputeEvidencePackModel,
  platformV7DisputeEvidencePackNextAction,
  platformV7DisputeEvidencePackSort,
  platformV7DisputeEvidencePackStatus,
  platformV7DisputeEvidencePackTone,
  platformV7DisputeEvidencePresentClasses,
} from '@/lib/platform-v7/dispute-evidence-pack';

const contract: PlatformV7EvidenceLedgerEntry = {
  id: 'EV-1',
  entityId: 'DL-1',
  entityType: 'deal',
  evidenceClass: 'contract',
  source: 'edo',
  status: 'anchored',
  hash: 'hash-1',
  signedAt: '2026-04-25T10:00:00.000Z',
  signedBy: 'seller-signature',
  title: 'Договор поставки',
};

const weightTicket: PlatformV7EvidenceLedgerEntry = {
  id: 'EV-2',
  entityId: 'DL-1',
  entityType: 'deal',
  evidenceClass: 'weight_ticket',
  source: 'operator_console',
  status: 'anchored',
  hash: 'hash-2',
  prevHash: 'hash-1',
  signedAt: '2026-04-25T10:10:00.000Z',
  signedBy: 'elevator-operator',
  title: 'Весовая квитанция',
};

const labProtocol: PlatformV7EvidenceLedgerEntry = {
  id: 'EV-3',
  entityId: 'DL-1',
  entityType: 'deal',
  evidenceClass: 'lab_protocol',
  source: 'lab_system',
  status: 'anchored',
  hash: 'hash-3',
  prevHash: 'hash-2',
  signedAt: '2026-04-25T10:20:00.000Z',
  signedBy: 'lab-specialist',
  title: 'Протокол лаборатории',
};

describe('platform-v7 dispute evidence pack', () => {
  it('marks dispute evidence pack complete when required classes and ledger are valid', () => {
    const model = platformV7DisputeEvidencePackModel({
      disputeId: 'DSP-1',
      dealId: 'DL-1',
      entries: [labProtocol, weightTicket, contract],
      requiredClasses: ['contract', 'weight_ticket', 'lab_protocol'],
      createdAt: '2026-04-25T11:00:00.000Z',
      createdBy: 'operator',
    });

    expect(model.status).toBe('complete');
    expect(model.canSubmit).toBe(true);
    expect(model.tone).toBe('success');
    expect(model.missingClasses).toEqual([]);
    expect(model.entries.map((entry) => entry.evidenceClass)).toEqual(['contract', 'weight_ticket', 'lab_protocol']);
  });

  it('marks pack incomplete when required class is missing', () => {
    const model = platformV7DisputeEvidencePackModel({
      disputeId: 'DSP-1',
      dealId: 'DL-1',
      entries: [contract, weightTicket],
      requiredClasses: ['contract', 'weight_ticket', 'lab_protocol'],
      createdAt: '2026-04-25T11:00:00.000Z',
      createdBy: 'operator',
    });

    expect(model.status).toBe('incomplete');
    expect(model.canSubmit).toBe(false);
    expect(model.missingClasses).toEqual(['lab_protocol']);
    expect(model.blockers).toContain('missing-class:lab_protocol');
  });

  it('marks pack broken when ledger chain is broken', () => {
    const model = platformV7DisputeEvidencePackModel({
      disputeId: 'DSP-1',
      dealId: 'DL-1',
      entries: [contract, { ...weightTicket, prevHash: 'wrong-hash' }],
      requiredClasses: ['contract', 'weight_ticket'],
      createdAt: '2026-04-25T11:00:00.000Z',
      createdBy: 'operator',
    });

    expect(model.status).toBe('broken');
    expect(model.canSubmit).toBe(false);
    expect(model.blockers).toContain('ledger:broken-chain:EV-2');
  });

  it('keeps helper outputs deterministic', () => {
    expect(platformV7DisputeEvidencePresentClasses([contract, weightTicket])).toEqual(['contract', 'weight_ticket']);
    expect(platformV7DisputeEvidenceMissingClasses(['contract', 'photo'], ['contract'])).toEqual(['photo']);
    expect(platformV7DisputeEvidencePackTone('broken')).toBe('danger');
    expect(platformV7DisputeEvidencePackNextAction('complete', [])).toBe('Dispute pack готов к передаче.');

    const sorted = platformV7DisputeEvidencePackSort([labProtocol, contract, weightTicket]);
    expect(sorted.map((entry) => entry.id)).toEqual(['EV-1', 'EV-2', 'EV-3']);
  });
});
