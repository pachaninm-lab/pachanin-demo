import { describe, expect, it } from 'vitest';
import type { PlatformV7EvidenceLedgerEntry } from '@/lib/platform-v7/evidence-ledger';
import {
  platformV7EvidenceLedgerBlockers,
  platformV7EvidenceLedgerModel,
  platformV7EvidenceLedgerNextAction,
  platformV7EvidenceLedgerStableKey,
  platformV7EvidenceLedgerStatus,
  platformV7EvidenceLedgerSummary,
  platformV7EvidenceLedgerTone,
} from '@/lib/platform-v7/evidence-ledger';

const firstEntry: PlatformV7EvidenceLedgerEntry = {
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

const secondEntry: PlatformV7EvidenceLedgerEntry = {
  id: 'EV-2',
  entityId: 'DL-1',
  entityType: 'deal',
  evidenceClass: 'bank_event',
  source: 'bank_webhook',
  status: 'anchored',
  hash: 'hash-2',
  prevHash: 'hash-1',
  signedAt: '2026-04-25T10:05:00.000Z',
  signedBy: 'bank-webhook',
  title: 'Резервирование денег',
};

describe('platform-v7 evidence ledger', () => {
  it('marks anchored hash chain as valid and dispute-ready', () => {
    const model = platformV7EvidenceLedgerModel([secondEntry, firstEntry]);

    expect(model.status).toBe('valid');
    expect(model.tone).toBe('success');
    expect(model.summary.total).toBe(2);
    expect(model.summary.anchored).toBe(2);
    expect(model.canUseForDisputePack).toBe(true);
    expect(model.entries.map((entry) => entry.id)).toEqual(['EV-1', 'EV-2']);
  });

  it('detects broken hash chain', () => {
    const model = platformV7EvidenceLedgerModel([
      firstEntry,
      { ...secondEntry, prevHash: 'wrong-hash' },
    ]);

    expect(model.status).toBe('broken');
    expect(model.tone).toBe('danger');
    expect(model.blockers).toContain('broken-chain:EV-2');
    expect(model.canUseForDisputePack).toBe(false);
  });

  it('keeps draft evidence in warning state', () => {
    const model = platformV7EvidenceLedgerModel([
      { ...firstEntry, status: 'draft' },
    ]);

    expect(model.status).toBe('warning');
    expect(model.tone).toBe('warning');
    expect(model.canUseForDisputePack).toBe(false);
  });

  it('blocks rejected evidence', () => {
    const model = platformV7EvidenceLedgerModel([
      { ...firstEntry, status: 'rejected' },
    ]);

    expect(model.status).toBe('broken');
    expect(model.blockers).toContain('rejected-evidence:EV-1');
  });

  it('keeps helper outputs deterministic', () => {
    expect(platformV7EvidenceLedgerBlockers([firstEntry])).toEqual([]);
    expect(platformV7EvidenceLedgerSummary([firstEntry]).uniqueSources).toBe(1);
    expect(platformV7EvidenceLedgerStatus([], platformV7EvidenceLedgerSummary([firstEntry]))).toBe('valid');
    expect(platformV7EvidenceLedgerTone('broken')).toBe('danger');
    expect(platformV7EvidenceLedgerNextAction('valid', [])).toBe('Evidence ledger готов для dispute pack.');
    expect(platformV7EvidenceLedgerStableKey(firstEntry)).toBe('deal:DL-1:contract:hash-1');
  });
});
