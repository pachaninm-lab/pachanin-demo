import { describe, it, expect } from 'vitest';
import {
  buildDealEvent,
  computeEventHash,
  verifyEventChain,
  GENESIS_HASH,
  type DealEventPayload,
} from './deal-event-chain';

describe('deal-event-chain', () => {
  const payload: DealEventPayload = { actorId: 'u1', actorRole: 'FARMER', newStatus: 'DRAFT' };

  it('builds an event with deterministic hash', () => {
    const ev = buildDealEvent({ id: 'e1', dealId: 'd1', eventType: 'DEAL_CREATED', payload, prevHash: GENESIS_HASH, occurredAt: '2024-01-01T00:00:00.000Z' });
    const expected = computeEventHash('e1', 'd1', 'DEAL_CREATED', payload, GENESIS_HASH);
    expect(ev.hash).toBe(expected);
    expect(ev.prevHash).toBe(GENESIS_HASH);
  });

  it('chains events correctly', () => {
    const ev1 = buildDealEvent({ id: 'e1', dealId: 'd1', eventType: 'DEAL_CREATED', payload, prevHash: GENESIS_HASH, occurredAt: '2024-01-01T00:00:00.000Z' });
    const ev2 = buildDealEvent({ id: 'e2', dealId: 'd1', eventType: 'DEAL_SIGNED', payload: { actorId: 'u2', actorRole: 'BUYER', newStatus: 'SIGNED' }, prevHash: ev1.hash, occurredAt: '2024-01-02T00:00:00.000Z' });
    expect(ev2.prevHash).toBe(ev1.hash);
  });

  it('verifies a valid chain', () => {
    const ev1 = buildDealEvent({ id: 'e1', dealId: 'd1', eventType: 'DEAL_CREATED', payload, prevHash: GENESIS_HASH, occurredAt: '2024-01-01T00:00:00.000Z' });
    const ev2 = buildDealEvent({ id: 'e2', dealId: 'd1', eventType: 'DEAL_SIGNED', payload: { actorId: 'u2', actorRole: 'BUYER', newStatus: 'SIGNED' }, prevHash: ev1.hash, occurredAt: '2024-01-02T00:00:00.000Z' });
    const result = verifyEventChain([ev1, ev2]);
    expect(result.valid).toBe(true);
  });

  it('detects hash tampering', () => {
    const ev1 = buildDealEvent({ id: 'e1', dealId: 'd1', eventType: 'DEAL_CREATED', payload, prevHash: GENESIS_HASH, occurredAt: '2024-01-01T00:00:00.000Z' });
    const ev2 = buildDealEvent({ id: 'e2', dealId: 'd1', eventType: 'DEAL_SIGNED', payload: { actorId: 'u2', actorRole: 'BUYER', newStatus: 'SIGNED' }, prevHash: ev1.hash, occurredAt: '2024-01-02T00:00:00.000Z' });
    const tampered = { ...ev1, payload: { ...ev1.payload, actorId: 'hacker' } };
    const result = verifyEventChain([tampered, ev2]);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBeDefined();
  });

  it('detects broken prevHash link', () => {
    const ev1 = buildDealEvent({ id: 'e1', dealId: 'd1', eventType: 'DEAL_CREATED', payload, prevHash: GENESIS_HASH, occurredAt: '2024-01-01T00:00:00.000Z' });
    const ev2 = buildDealEvent({ id: 'e2', dealId: 'd1', eventType: 'DEAL_SIGNED', payload: { actorId: 'u2', actorRole: 'BUYER', newStatus: 'SIGNED' }, prevHash: 'deadbeef', occurredAt: '2024-01-02T00:00:00.000Z' });
    const result = verifyEventChain([ev1, ev2]);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });

  it('empty chain is valid', () => {
    expect(verifyEventChain([]).valid).toBe(true);
  });

  it('single genesis event is valid', () => {
    const ev = buildDealEvent({ id: 'e1', dealId: 'd1', eventType: 'DEAL_CREATED', payload, prevHash: GENESIS_HASH, occurredAt: '2024-01-01T00:00:00.000Z' });
    expect(verifyEventChain([ev]).valid).toBe(true);
  });
});
