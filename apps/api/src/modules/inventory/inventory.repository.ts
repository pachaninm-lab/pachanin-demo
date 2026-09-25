import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import { validateInventoryCommand, type InventoryCommand, type InventoryPositionView, type InventoryReceipt } from './inventory.contract';

@Injectable()
export class InventoryRepository {
  constructor(private readonly rls: RlsTransactionService) {}

  async execute(user: RequestUser, command: InventoryCommand): Promise<InventoryReceipt> {
    validateInventoryCommand(command);
    try {
      return await this.rls.withTrustedContext(user, async (tx) => {
        const rows = await tx.$queryRaw<Array<{ receipt: InventoryReceipt }>>(Prisma.sql`
          SELECT inventory.execute_command(${JSON.stringify(command)}::jsonb) AS receipt
        `);
        // Flush deferred dependencies before the transaction driver returns an
        // acknowledgement. A failed commit must never look like an accepted command.
        await tx.$executeRaw(Prisma.sql`SET CONSTRAINTS ALL IMMEDIATE`);
        if (!rows[0]?.receipt) throw new Error('INVENTORY_COMMAND_RECEIPT_MISSING');
        return rows[0].receipt;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxConflictRetries: 0 });
    } catch (error) {
      const meta = error && typeof error === 'object' ? (error as { meta?: { code?: string; message?: string } }).meta : undefined;
      const code = meta?.message?.match(/\bINVENTORY_[A-Z_]+\b/u)?.[0] ?? 'INVENTORY_COMMAND_REJECTED';
      if (meta?.code === '42501') throw new ForbiddenException({ code });
      if (meta?.code === 'P0002') throw new NotFoundException({ code });
      if (meta?.code === '40001' || meta?.code === '23505') throw new ConflictException({ code, refreshRequired: true });
      if (meta?.code === '22023' || meta?.code === '23514') throw new UnprocessableEntityException({ code });
      throw error;
    }
  }

  async listOwn(user: RequestUser, after = '') {
    return this.rls.withTrustedContext(user, async (tx, context) => {
      const rows = await tx.$queryRaw<Array<{ item: InventoryPositionView }>>(Prisma.sql`
        SELECT inventory.position_view(p) || jsonb_build_object(
          'stockKey', b.stock_key, 'sourceType', b.source_type, 'sourceReference', b.source_reference,
          'profileVersionId', b.profile_version_id, 'profileContentHash', b.profile_content_hash,
          'baseUnitCode', b.base_unit_code, 'baseUnitPrecision', b.base_unit_precision, 'dimension', b.dimension
        ) AS item
        FROM inventory.positions p JOIN inventory.batches b ON b.id = p.batch_id
        WHERE p.tenant_id = ${context.tenantId} AND p.organization_id = ${context.orgId} AND p.id > ${after}
        ORDER BY p.id LIMIT 51
      `);
      const items = rows.slice(0, 50).map((row) => row.item);
      return { authority: 'POSTGRESQL' as const, items, nextCursor: rows.length > 50 ? items[49]!.positionId : null };
    });
  }
}
