import { describe, it, expect } from 'vitest';
import { AuditLog, AUDIT_GENESIS_HASH } from './audit-log';

const base = { actorId: 'u1', actorRole: 'ADMIN', action: 'USER_LOGIN' as const, resourceType: 'session', resourceId: 's1' };

describe('AuditLog', () => {
  it('first entry prevHash is genesis hash', () => {
    const log = new AuditLog();
    const e = log.append(base);
    expect(e.prevHash).toBe(AUDIT_GENESIS_HASH);
  });

  it('chains subsequent entries', () => {
    const log = new AuditLog();
    const e1 = log.append(base);
    const e2 = log.append({ ...base, action: 'USER_LOGOUT' });
    expect(e2.prevHash).toBe(e1.hash);
  });

  it('verifies intact chain', () => {
    const log = new AuditLog();
    log.append(base);
    log.append({ ...base, action: 'MFA_VERIFIED' });
    expect(log.verify().valid).toBe(true);
  });

  it('detects tampered entry', () => {
    const log = new AuditLog();
    log.append(base);
    (log as unknown as { entries: object[] })['entries'][0] = { ...(log as unknown as { entries: object[] })['entries'][0], actorId: 'hacker' };
    expect(log.verify().valid).toBe(false);
  });

  it('queries by actor', () => {
    const log = new AuditLog();
    log.append(base);
    log.append({ ...base, actorId: 'u2' });
    expect(log.query({ actorId: 'u1' }).length).toBe(1);
  });

  it('queries by action', () => {
    const log = new AuditLog();
    log.append(base);
    log.append({ ...base, action: 'PAYMENT_RELEASED' });
    expect(log.query({ action: 'PAYMENT_RELEASED' }).length).toBe(1);
  });

  it('PERSONAL_DATA_ACCESSED is a valid 152-FZ action', () => {
    const log = new AuditLog();
    const e = log.append({ ...base, action: 'PERSONAL_DATA_ACCESSED', resourceType: 'user_profile', resourceId: 'u99' });
    expect(e.action).toBe('PERSONAL_DATA_ACCESSED');
    expect(log.verify().valid).toBe(true);
  });
});
