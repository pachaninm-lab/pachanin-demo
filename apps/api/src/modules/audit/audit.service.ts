import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface AuditLogParams {
  action: string;
  actorUserId: string;
  actorRole: string;
  tenantId?: string;
  orgId?: string;
  dealId?: string;
  disputeId?: string;
  objectType?: string;
  objectId?: string;
  beforeState?: unknown;
  afterState?: unknown;
  outcome?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId?: string;
  meta?: unknown;
  hash?: string;
  createdAt: string;
}

const MAX_IN_MEMORY = 500;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly inMemory: AuditEntry[] = [];
  private lastHash = '';

  constructor(private readonly prisma: PrismaService) {}

  private computeHash(id: string, action: string, actorUserId: string, actorRole: string, dealId: string | null, objectType: string | null, objectId: string | null, outcome: string, prevHash: string): string {
    return createHash('sha256').update(JSON.stringify({ id, action, actorUserId, actorRole, dealId, objectType, objectId, outcome, prevHash })).digest('hex');
  }

  log(entry: {
    action: string;
    entityType?: string;
    entityId?: string;
    actorUserId?: string;
    actorRole?: string;
    dealId?: string;
    disputeId?: string;
    objectType?: string;
    objectId?: string;
    beforeState?: unknown;
    afterState?: unknown;
    outcome?: string;
    reason?: string;
    tenantId?: string;
    orgId?: string;
    meta?: unknown;
  }): AuditEntry {
    const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const prevHash = this.lastHash;
    const objectType = entry.objectType ?? entry.entityType ?? '';
    const objectId = entry.objectId ?? entry.entityId ?? '';
    const actorUserId = entry.actorUserId ?? 'system';
    const actorRole = entry.actorRole ?? 'SYSTEM';
    const outcome = entry.outcome ?? 'SUCCESS';
    const hash = this.computeHash(id, entry.action, actorUserId, actorRole, entry.dealId ?? null, objectType, objectId, outcome, prevHash);
    this.lastHash = hash;
    const createdAt = new Date().toISOString();

    this.prisma.auditEvent.create({
      data: {
        id,
        action: entry.action,
        actorUserId,
        actorRole,
        tenantId: entry.tenantId,
        orgId: entry.orgId,
        dealId: entry.dealId,
        disputeId: entry.disputeId,
        objectType,
        objectId,
        beforeState: entry.beforeState ? JSON.stringify(entry.beforeState) : null,
        afterState: entry.afterState ? JSON.stringify(entry.afterState) : null,
        outcome,
        reason: entry.reason,
        metadata: entry.meta ? JSON.stringify(entry.meta) : null,
        hash,
        prevHash: prevHash || null,
      },
    }).catch((err) => this.logger.debug(`Audit DB write: ${err.message}`));

    const record: AuditEntry = { id, action: entry.action, entityType: objectType, entityId: objectId, actorUserId, hash, createdAt };
    this.inMemory.push(record);
    if (this.inMemory.length > MAX_IN_MEMORY) this.inMemory.splice(0, this.inMemory.length - MAX_IN_MEMORY);
    return record;
  }

  async list() {
    try {
      const rows = await this.prisma.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
      return rows.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.objectType ?? '',
        entityId: r.objectId ?? '',
        actorUserId: r.actorUserId,
        hash: r.hash,
        prevHash: r.prevHash,
        meta: r.metadata ?? undefined,
        createdAt: r.createdAt.toISOString(),
      }));
    } catch {
      return [...this.inMemory].reverse();
    }
  }

  async verifyChainIntegrity(limit = 1000): Promise<{ valid: boolean; brokenAt?: string; checked: number }> {
    const events = await this.prisma.auditEvent.findMany({ orderBy: { createdAt: 'asc' }, take: limit }).catch(() => []);
    let prevHash = '';
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (!e.hash) { prevHash = ''; continue; }
      const expected = this.computeHash(e.id, e.action, e.actorUserId, e.actorRole, e.dealId ?? null, e.objectType ?? null, e.objectId ?? null, e.outcome, prevHash);
      if (e.hash !== expected) return { valid: false, brokenAt: e.id, checked: i + 1 };
      prevHash = e.hash;
    }
    return { valid: true, checked: events.length };
  }
}
