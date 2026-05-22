import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  let outbox: OutboxService;

  beforeEach(() => {
    outbox = new OutboxService();
  });

  it('enqueues entry as PENDING', () => {
    const entry = outbox.enqueue({ type: 'BANK_RESERVE_REQUEST', dealId: 'DEAL-001', payload: {} });
    expect(entry.status).toBe('PENDING');
    expect(entry.retryCount).toBe(0);
    expect(outbox.listPending()).toHaveLength(1);
  });

  it('confirms entry', () => {
    const entry = outbox.enqueue({ type: 'BANK_RESERVE_REQUEST', dealId: 'DEAL-001', payload: {} });
    const confirmed = outbox.confirm(entry.id);
    expect(confirmed.status).toBe('CONFIRMED');
    expect(confirmed.confirmedAt).toBeDefined();
    expect(outbox.listPending()).toHaveLength(0);
  });

  it('marks entry as sent', () => {
    const entry = outbox.enqueue({ type: 'BANK_RELEASE_REQUEST', dealId: 'DEAL-002', payload: {} });
    const sent = outbox.markSent(entry.id);
    expect(sent.status).toBe('SENT');
    expect(sent.sentAt).toBeDefined();
  });

  it('escalates to MANUAL_REVIEW after 3 failures', () => {
    const entry = outbox.enqueue({ type: 'BANK_RESERVE_REQUEST', dealId: 'DEAL-001', payload: {} });
    outbox.markFailed(entry.id, 'timeout');
    outbox.markFailed(entry.id, 'timeout');
    const final = outbox.markFailed(entry.id, 'timeout');
    expect(final.status).toBe('MANUAL_REVIEW');
    expect(final.retryCount).toBe(3);
    expect(outbox.listManualReview()).toHaveLength(1);
  });

  it('stays FAILED before reaching retry limit', () => {
    const entry = outbox.enqueue({ type: 'BANK_RESERVE_REQUEST', dealId: 'DEAL-001', payload: {} });
    const failed = outbox.markFailed(entry.id, 'timeout');
    expect(failed.status).toBe('FAILED');
    expect(failed.retryCount).toBe(1);
    expect(outbox.listPending()).toHaveLength(1);
  });

  it('filters entries by dealId', () => {
    outbox.enqueue({ type: 'BANK_RESERVE_REQUEST', dealId: 'DEAL-001', payload: {} });
    outbox.enqueue({ type: 'BANK_RELEASE_REQUEST', dealId: 'DEAL-002', payload: {} });
    expect(outbox.getByDeal('DEAL-001')).toHaveLength(1);
    expect(outbox.getByDeal('DEAL-002')).toHaveLength(1);
    expect(outbox.getByDeal('DEAL-NONE')).toHaveLength(0);
  });

  it('bank callback confirms reserve and does not auto-release', () => {
    const reserveEntry = outbox.enqueue({ type: 'BANK_RESERVE_REQUEST', dealId: 'DEAL-001', payload: {} });
    // Simulate bank success callback
    outbox.confirm(reserveEntry.id);
    // Release must require a separate outbox entry
    expect(outbox.listPending()).toHaveLength(0);
    expect(outbox.listManualReview()).toHaveLength(0);
  });

  it('throws when confirming non-existent entry', () => {
    expect(() => outbox.confirm('OUTBOX-NONE')).toThrow('Outbox entry OUTBOX-NONE not found');
  });
});
