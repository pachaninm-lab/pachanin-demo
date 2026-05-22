import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId?: string;
  meta?: any;
  createdAt: string;
}

const MAX_IN_MEMORY = 500;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly inMemory: AuditEntry[] = [];

  constructor(private readonly prisma: PrismaService) {}

  log(entry: {
    action: string;
    entityType: string;
    entityId: string;
    actorUserId?: string;
    actorRole?: string;
    dealId?: string;
    outcome?: string;
    meta?: any;
  }) {
    const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = new Date().toISOString();

    // Fire-and-forget to DB; always also keep in-memory ring buffer
    this.prisma.auditEvent.create({
      data: {
        id,
        action: entry.action,
        actorUserId: entry.actorUserId ?? 'system',
        actorRole: entry.actorRole ?? 'SYSTEM',
        dealId: entry.dealId,
        objectType: entry.entityType,
        objectId: entry.entityId,
        outcome: entry.outcome ?? 'ALLOWED',
        metadata: entry.meta ? JSON.stringify(entry.meta) : null,
      },
    }).catch((err) => this.logger.debug(`Audit DB write skipped: ${err.message}`));

    const record: AuditEntry = { id, ...entry, createdAt };
    this.inMemory.push(record);
    if (this.inMemory.length > MAX_IN_MEMORY) {
      this.inMemory.splice(0, this.inMemory.length - MAX_IN_MEMORY);
    }
    return record;
  }

  async list() {
    try {
      const rows = await this.prisma.auditEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return rows.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.objectType ?? '',
        entityId: r.objectId ?? '',
        actorUserId: r.actorUserId,
        meta: r.metadata ? JSON.parse(r.metadata) : undefined,
        createdAt: r.createdAt.toISOString(),
      }));
    } catch {
      return [...this.inMemory].reverse();
    }
  }
}
