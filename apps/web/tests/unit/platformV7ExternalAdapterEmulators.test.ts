import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createBankAdapterEmulator } from '@/lib/platform-v7/bank-adapter-emulator';
import { createEdoAdapterEmulator } from '@/lib/platform-v7/edo-adapter-emulator';
import { createEpdAdapterEmulator } from '@/lib/platform-v7/epd-adapter-emulator';
import { createFgisAdapterEmulator } from '@/lib/platform-v7/fgis-adapter-emulator';
import {
  platformV7CreateMockAdapter,
  platformV7CreateMockAdapterRegistry,
} from '@/lib/platform-v7/external-adapters';

const now = '2026-05-24T12:00:00.000Z';

const ctx = {
  correlationId: 'corr-1',
  auditId: 'audit-1',
  actorId: 'operator-1',
  organizationId: 'org-1',
  role: 'operator',
};

describe('BankAdapterEmulator', () => {
  it('emits reserve_requested with correct envelope', () => {
    const emulator = createBankAdapterEmulator({ fixedNow: now });
    const event = emulator.emit('reserve_requested', 'corr-1', { dealId: 'deal-1', amount: 1000, currency: 'RUB' });

    expect(event.source).toBe('bank_emulator');
    expect(event.maturity).toBe('pre-integration');
    expect(event.externalStatus).toBe('reserve_requested');
    expect(event.receivedAt).toBe(now);
    expect(event.correlationId).toBe('corr-1');
  });

  it('is idempotent: same (eventType, correlationId) returns identical object', () => {
    const emulator = createBankAdapterEmulator({ fixedNow: now });
    const payload = { dealId: 'deal-1', amount: 1000 };
    const first = emulator.emit('reserve_requested', 'corr-1', payload);
    const second = emulator.emit('reserve_requested', 'corr-1', { ...payload, amount: 999 });

    expect(first).toBe(second);
    expect(second.payload.amount).toBe(1000);
  });

  it('returns invalid_payload for reserve_confirmed without prior reserve_requested', () => {
    const emulator = createBankAdapterEmulator({ fixedNow: now });
    const event = emulator.emit('reserve_confirmed', 'corr-1', { dealId: 'deal-1' });
    expect(event.externalStatus).toBe('invalid_payload');
  });

  it('allows reserve_confirmed after reserve_requested', () => {
    const emulator = createBankAdapterEmulator({ fixedNow: now });
    emulator.emit('reserve_requested', 'corr-1', { dealId: 'deal-1', amount: 1000 });
    const confirmed = emulator.emit('reserve_confirmed', 'corr-1', { dealId: 'deal-1', amount: 1000 });
    expect(confirmed.externalStatus).toBe('reserve_confirmed');
  });

  it('allows release_confirmed after release_requested', () => {
    const emulator = createBankAdapterEmulator({ fixedNow: now });
    emulator.emit('release_requested', 'corr-1', { dealId: 'deal-1', amount: 1000 });
    const confirmed = emulator.emit('release_confirmed', 'corr-1', { dealId: 'deal-1', amount: 1000 });
    expect(confirmed.externalStatus).toBe('release_confirmed');
  });

  it('injects manual_review via config override', () => {
    const emulator = createBankAdapterEmulator({ fixedNow: now, manualReviewCorrelationIds: ['corr-review'] });
    const event = emulator.emit('reserve_requested', 'corr-review', { dealId: 'deal-1' });
    expect(event.externalStatus).toBe('manual_review');
  });

  it('injects rejected via config override', () => {
    const emulator = createBankAdapterEmulator({ fixedNow: now, rejectedCorrelationIds: ['corr-reject'] });
    const event = emulator.emit('release_requested', 'corr-reject', { dealId: 'deal-1' });
    expect(event.externalStatus).toBe('rejected');
  });

  it('injects reconciliation_mismatch via config override', () => {
    const emulator = createBankAdapterEmulator({ fixedNow: now, reconciliationMismatchCorrelationIds: ['corr-mismatch'] });
    const event = emulator.emit('reserve_requested', 'corr-mismatch', { dealId: 'deal-1' });
    expect(event.externalStatus).toBe('reconciliation_mismatch');
  });

  it('tracks all events in getLedger', () => {
    const emulator = createBankAdapterEmulator({ fixedNow: now });
    emulator.emit('reserve_requested', 'corr-1', { dealId: 'deal-1', amount: 1000 });
    emulator.emit('reserve_confirmed', 'corr-1', { dealId: 'deal-1' });
    expect(emulator.getLedger()).toHaveLength(2);
  });

  it('clears ledger on reset', () => {
    const emulator = createBankAdapterEmulator({ fixedNow: now });
    emulator.emit('reserve_requested', 'corr-1', { dealId: 'deal-1' });
    emulator.reset();
    expect(emulator.getLedger()).toHaveLength(0);
    const event = emulator.emit('reserve_confirmed', 'corr-1', { dealId: 'deal-1' });
    expect(event.externalStatus).toBe('invalid_payload');
  });
});

describe('EdoAdapterEmulator', () => {
  it('emits document_draft_created with correct envelope', () => {
    const emulator = createEdoAdapterEmulator({ fixedNow: now });
    const event = emulator.emit('document_draft_created', 'corr-1', { dealId: 'deal-1', documentId: 'doc-1' });

    expect(event.source).toBe('edo_emulator');
    expect(event.maturity).toBe('pre-integration');
    expect(event.externalStatus).toBe('document_draft_created');
  });

  it('returns invalid_payload for document_sent without prior document_draft_created', () => {
    const emulator = createEdoAdapterEmulator({ fixedNow: now });
    const event = emulator.emit('document_sent', 'corr-1', { dealId: 'deal-1' });
    expect(event.externalStatus).toBe('invalid_payload');
  });

  it('advances through full EDO document lifecycle', () => {
    const emulator = createEdoAdapterEmulator({ fixedNow: now });
    const payload = { dealId: 'deal-1', documentId: 'doc-1' };
    emulator.emit('document_draft_created', 'corr-1', payload);
    emulator.emit('document_sent', 'corr-1', payload);
    emulator.emit('document_signed_by_one_side', 'corr-1', payload);
    const final = emulator.emit('document_signed_by_all_sides', 'corr-1', payload);

    expect(final.externalStatus).toBe('document_signed_by_all_sides');
    expect(emulator.getLedger()).toHaveLength(4);
  });

  it('injects timeout via config override', () => {
    const emulator = createEdoAdapterEmulator({ fixedNow: now, timeoutCorrelationIds: ['corr-timeout'] });
    const event = emulator.emit('document_draft_created', 'corr-timeout', { dealId: 'deal-1' });
    expect(event.externalStatus).toBe('timeout');
  });

  it('clears ledger on reset', () => {
    const emulator = createEdoAdapterEmulator({ fixedNow: now });
    emulator.emit('document_draft_created', 'corr-1', { dealId: 'deal-1' });
    emulator.reset();
    expect(emulator.getLedger()).toHaveLength(0);
  });
});

describe('FgisAdapterEmulator', () => {
  it('emits party_link_requested with correct envelope', () => {
    const emulator = createFgisAdapterEmulator({ fixedNow: now });
    const event = emulator.emit('party_link_requested', 'corr-1', { dealId: 'deal-1', partyInn: '123456789' });

    expect(event.source).toBe('fgis_emulator');
    expect(event.maturity).toBe('pre-integration');
    expect(event.externalStatus).toBe('party_link_requested');
  });

  it('returns invalid_payload for party_linked without prior party_link_requested', () => {
    const emulator = createFgisAdapterEmulator({ fixedNow: now });
    const event = emulator.emit('party_linked', 'corr-1', { dealId: 'deal-1' });
    expect(event.externalStatus).toBe('invalid_payload');
  });

  it('advances through full SDIZ lifecycle', () => {
    const emulator = createFgisAdapterEmulator({ fixedNow: now });
    const payload = { dealId: 'deal-1', sdizId: 'sdiz-1' };
    emulator.emit('sdiz_draft_created', 'corr-1', payload);
    emulator.emit('sdiz_ready_to_sign', 'corr-1', payload);
    emulator.emit('sdiz_signed', 'corr-1', payload);
    emulator.emit('sdiz_sent', 'corr-1', payload);
    const redeemed = emulator.emit('sdiz_redeemed', 'corr-1', payload);

    expect(redeemed.externalStatus).toBe('sdiz_redeemed');
    expect(emulator.getLedger()).toHaveLength(5);
  });

  it('injects sdiz_error via config override', () => {
    const emulator = createFgisAdapterEmulator({ fixedNow: now, sdizErrorCorrelationIds: ['corr-err'] });
    const event = emulator.emit('sdiz_draft_created', 'corr-err', { dealId: 'deal-1' });
    expect(event.externalStatus).toBe('sdiz_error');
  });

  it('injects conflict via config override', () => {
    const emulator = createFgisAdapterEmulator({ fixedNow: now, conflictCorrelationIds: ['corr-conflict'] });
    const event = emulator.emit('party_link_requested', 'corr-conflict', { dealId: 'deal-1' });
    expect(event.externalStatus).toBe('conflict');
  });
});

describe('EpdAdapterEmulator', () => {
  it('emits epd_draft_created with correct envelope', () => {
    const emulator = createEpdAdapterEmulator({ fixedNow: now });
    const event = emulator.emit('epd_draft_created', 'corr-1', { dealId: 'deal-1', tripId: 'trip-1' });

    expect(event.source).toBe('epd_emulator');
    expect(event.maturity).toBe('pre-integration');
    expect(event.externalStatus).toBe('epd_draft_created');
  });

  it('returns invalid_payload for epd_sent without prior epd_draft_created', () => {
    const emulator = createEpdAdapterEmulator({ fixedNow: now });
    const event = emulator.emit('epd_sent', 'corr-1', { dealId: 'deal-1', tripId: 'trip-1' });
    expect(event.externalStatus).toBe('invalid_payload');
  });

  it('advances through EPD lifecycle', () => {
    const emulator = createEpdAdapterEmulator({ fixedNow: now });
    const payload = { dealId: 'deal-1', tripId: 'trip-1', documentId: 'doc-1' };
    emulator.emit('epd_draft_created', 'corr-1', payload);
    emulator.emit('epd_sent', 'corr-1', payload);
    const confirmed = emulator.emit('epd_confirmed', 'corr-1', payload);

    expect(confirmed.externalStatus).toBe('epd_confirmed');
    expect(emulator.getLedger()).toHaveLength(3);
  });

  it('returns invalid_payload for arrival_confirmed without prior trip_event_received', () => {
    const emulator = createEpdAdapterEmulator({ fixedNow: now });
    const event = emulator.emit('arrival_confirmed', 'corr-1', { dealId: 'deal-1', tripId: 'trip-1' });
    expect(event.externalStatus).toBe('invalid_payload');
  });

  it('injects conflict via config override', () => {
    const emulator = createEpdAdapterEmulator({ fixedNow: now, conflictCorrelationIds: ['corr-conflict'] });
    const event = emulator.emit('epd_draft_created', 'corr-conflict', { dealId: 'deal-1', tripId: 'trip-1' });
    expect(event.externalStatus).toBe('conflict');
  });

  it('clears ledger on reset', () => {
    const emulator = createEpdAdapterEmulator({ fixedNow: now });
    emulator.emit('epd_draft_created', 'corr-1', { dealId: 'deal-1', tripId: 'trip-1' });
    emulator.reset();
    expect(emulator.getLedger()).toHaveLength(0);
  });
});

describe('platformV7CreateMockAdapterRegistry', () => {
  it('provides all 8 external systems with mock provider', () => {
    const registry = platformV7CreateMockAdapterRegistry();
    const systems = ['bank', 'fgis', 'edo', 'epd', 'logistics', 'lab', 'oneC', 'notification'] as const;
    for (const system of systems) {
      expect(registry[system], system).toBeDefined();
      expect(registry[system].provider, system).toBe('mock');
      expect(registry[system].system, system).toBe(system);
    }
  });

  it('each adapter call returns doesNotConfirmExternally: true with pending status', async () => {
    const registry = platformV7CreateMockAdapterRegistry();
    const result = await registry.bank.call({
      operation: 'requestReserve',
      dealId: 'deal-1',
      amount: 1000,
      currency: 'RUB',
      context: ctx,
    });

    expect(result.doesNotConfirmExternally).toBe(true);
    expect(result.status).toBe('pending');
    expect(result.provider).toBe('mock');
    expect(result.system).toBe('bank');
  });

  it('adapter healthCheck returns available for all systems', async () => {
    const systems = ['bank', 'fgis', 'edo', 'epd', 'logistics', 'lab', 'oneC', 'notification'] as const;
    for (const system of systems) {
      const adapter = platformV7CreateMockAdapter(system);
      const health = await adapter.healthCheck();
      expect(health.status, system).toBe('available');
      expect(health.provider, system).toBe('mock');
      expect(health.system, system).toBe(system);
    }
  });

  it('each adapter externalCallId includes system and correlationId', async () => {
    const adapter = platformV7CreateMockAdapter('fgis');
    const result = await adapter.call({
      operation: 'createGrainBatchDraft',
      context: ctx,
    });
    expect(result.externalCallId).toContain('fgis');
    expect(result.externalCallId).toContain('corr-1');
  });
});

describe('source guard: adapter emulator files are pre-integration with no live calls', () => {
  const adapterFiles = [
    'lib/platform-v7/bank-adapter-emulator.ts',
    'lib/platform-v7/edo-adapter-emulator.ts',
    'lib/platform-v7/fgis-adapter-emulator.ts',
    'lib/platform-v7/epd-adapter-emulator.ts',
    'lib/platform-v7/external-adapters.ts',
  ] as const;

  const forbiddenPatterns = [
    'fetch(',
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
    'axios.',
    'http.request',
    'https.request',
    'bank connected',
    'fgis connected',
    'edo connected',
    'epd connected',
  ] as const;

  it('all adapter emulator source files are present', () => {
    for (const file of adapterFiles) {
      expect(existsSync(join(process.cwd(), file)), file).toBe(true);
    }
  });

  it('contains no live network calls or connected system references', () => {
    for (const file of adapterFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      for (const pattern of forbiddenPatterns) {
        expect(source, `${file} must not contain "${pattern}"`).not.toContain(pattern);
      }
    }
  });

  it('all adapter emulators declare pre-integration maturity', () => {
    const emulatorFiles = [
      'lib/platform-v7/bank-adapter-emulator.ts',
      'lib/platform-v7/edo-adapter-emulator.ts',
      'lib/platform-v7/fgis-adapter-emulator.ts',
      'lib/platform-v7/epd-adapter-emulator.ts',
    ] as const;
    for (const file of emulatorFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source, file).toContain('pre-integration');
    }
  });
});
