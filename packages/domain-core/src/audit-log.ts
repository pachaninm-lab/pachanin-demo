import { createHash } from 'crypto';

export type AuditAction =
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'MFA_ENROLLED'
  | 'MFA_VERIFIED'
  | 'MFA_FAILED'
  | 'DEAL_CREATED'
  | 'DEAL_SIGNED'
  | 'PAYMENT_RESERVED'
  | 'PAYMENT_RELEASED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_SIGNED'
  | 'DISPUTE_OPENED'
  | 'ARBITRATION_DECIDED'
  | 'ROLE_CHANGED'
  | 'CONFIG_CHANGED'
  | 'DATA_EXPORT'
  | 'PERSONAL_DATA_ACCESSED'; // 152-ФЗ marker

export interface AuditLogEntry {
  readonly id: string;
  readonly sessionId?: string;
  readonly actorId: string;
  readonly actorRole: string;
  readonly action: AuditAction;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly prevHash: string;
  readonly hash: string;
  readonly occurredAt: string;
  readonly meta?: Record<string, unknown>;
}

function hashEntry(entry: Omit<AuditLogEntry, 'hash'>): string {
  const data = JSON.stringify({
    id: entry.id,
    actorId: entry.actorId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    prevHash: entry.prevHash,
    occurredAt: entry.occurredAt,
  });
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

export const AUDIT_GENESIS_HASH = '0'.repeat(64);

export class AuditLog {
  private readonly entries: AuditLogEntry[] = [];

  append(params: Omit<AuditLogEntry, 'hash' | 'prevHash' | 'occurredAt'>): AuditLogEntry {
    const prevHash = this.entries.length > 0 ? this.entries[this.entries.length - 1].hash : AUDIT_GENESIS_HASH;
    const occurredAt = new Date().toISOString();
    const partial = { ...params, prevHash, occurredAt };
    const hash = hashEntry(partial);
    const entry: AuditLogEntry = { ...partial, hash };
    this.entries.push(entry);
    return entry;
  }

  verify(): { valid: boolean; brokenAt?: number } {
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      const expected = hashEntry(e);
      if (e.hash !== expected) return { valid: false, brokenAt: i };
      const expectedPrev = i === 0 ? AUDIT_GENESIS_HASH : this.entries[i - 1].hash;
      if (e.prevHash !== expectedPrev) return { valid: false, brokenAt: i };
    }
    return { valid: true };
  }

  query(filter: Partial<Pick<AuditLogEntry, 'actorId' | 'action' | 'resourceType' | 'resourceId'>>): readonly AuditLogEntry[] {
    return this.entries.filter((e) => {
      if (filter.actorId && e.actorId !== filter.actorId) return false;
      if (filter.action && e.action !== filter.action) return false;
      if (filter.resourceType && e.resourceType !== filter.resourceType) return false;
      if (filter.resourceId && e.resourceId !== filter.resourceId) return false;
      return true;
    });
  }

  get length() {
    return this.entries.length;
  }
}
