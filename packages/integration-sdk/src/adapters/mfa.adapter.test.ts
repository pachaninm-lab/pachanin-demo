import { describe, it, expect, beforeEach } from 'vitest';
import { MockTotpAdapter, MockSmsOtpAdapter } from './mfa.adapter';

describe('MockTotpAdapter', () => {
  let adapter: MockTotpAdapter;
  beforeEach(() => { adapter = new MockTotpAdapter(); });

  it('enrolls a user and returns secret + URI + backup codes', async () => {
    const res = await adapter.enroll({ userId: 'u1', issuer: 'GrainFlow' });
    expect(res.secret).toBeTruthy();
    expect(res.otpauthUri).toContain('otpauth://totp/');
    expect(res.backupCodes.length).toBe(8);
  });

  it('verifies valid 6-digit code', async () => {
    await adapter.enroll({ userId: 'u1' });
    const res = await adapter.verify({ userId: 'u1', code: '123456', secret: 'any' });
    expect(res.valid).toBe(true);
  });

  it('rejects 000000', async () => {
    const res = await adapter.verify({ userId: 'u1', code: '000000', secret: 'any' });
    expect(res.valid).toBe(false);
  });

  it('rejects non-6-digit code', async () => {
    const res = await adapter.verify({ userId: 'u1', code: 'abc', secret: 'any' });
    expect(res.valid).toBe(false);
  });

  it('health returns ok', async () => {
    const h = await adapter.health();
    expect(h.status).toBe('ok');
  });
});

describe('MockSmsOtpAdapter', () => {
  let adapter: MockSmsOtpAdapter;
  beforeEach(() => { adapter = new MockSmsOtpAdapter(); });

  it('sends OTP and returns masked phone', async () => {
    const res = await adapter.send({ userId: 'u1', phone: '+79001234567', purpose: 'login' });
    expect(res.requestId).toBeTruthy();
    expect(res.maskedPhone).not.toContain('9001234');
    expect(new Date(res.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('verifies correct code', async () => {
    const { requestId } = await adapter.send({ userId: 'u1', phone: '+79001234567', purpose: 'login' });
    const res = await adapter.verify({ requestId, code: '123456' });
    expect(res.valid).toBe(true);
  });

  it('rejects wrong code and decrements attempts', async () => {
    const { requestId } = await adapter.send({ userId: 'u1', phone: '+79001234567', purpose: 'login' });
    const res = await adapter.verify({ requestId, code: '999999' });
    expect(res.valid).toBe(false);
    expect(res.remainingAttempts).toBe(2);
  });

  it('rejects unknown requestId', async () => {
    const res = await adapter.verify({ requestId: 'nonexistent', code: '123456' });
    expect(res.valid).toBe(false);
    expect(res.remainingAttempts).toBe(0);
  });

  it('invalidates token after correct verification', async () => {
    const { requestId } = await adapter.send({ userId: 'u1', phone: '+79001234567', purpose: 'deal_sign' });
    await adapter.verify({ requestId, code: '123456' });
    const res2 = await adapter.verify({ requestId, code: '123456' });
    expect(res2.valid).toBe(false);
  });

  it('health returns ok', async () => {
    const h = await adapter.health();
    expect(h.status).toBe('ok');
  });
});
