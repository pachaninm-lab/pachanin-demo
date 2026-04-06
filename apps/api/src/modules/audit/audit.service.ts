import { Injectable } from '@nestjs/common';

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId?: string;
  meta?: any;
  createdAt: string;
}

const MAX_ENTRIES = 500;

@Injectable()
export class AuditService {
  private readonly entries: AuditEntry[] = [];

  log(entry: { action: string; entityType: string; entityId: string; actorUserId?: string; meta?: any }) {
    const record: AuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...entry,
      createdAt: new Date().toISOString(),
    };
    this.entries.push(record);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }
    return record;
  }

  list() {
    return [...this.entries].reverse();
  }
}
