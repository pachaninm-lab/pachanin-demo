import { Injectable, ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';

const EXPORT_ALLOWED_ROLES: Role[] = [Role.ADMIN, Role.COMPLIANCE_OFFICER, Role.ACCOUNTING, Role.EXECUTIVE];

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertExportRole(user: RequestUser): void {
    if (!EXPORT_ALLOWED_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Export access denied');
    }
  }

  async exportDealsCsv(user: RequestUser, filters?: { status?: string; from?: string; to?: string }): Promise<string> {
    this.assertExportRole(user);
    const deals = await this.prisma.deal.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.from && { createdAt: { gte: new Date(filters.from) } }),
        ...(filters?.to && { createdAt: { lte: new Date(filters.to) } }),
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });
    const header = 'id,dealNumber,status,sellerOrgId,buyerOrgId,culture,cropClass,volumeTons,totalRub,currency,region,createdAt,closedAt\n';
    const rows = deals.map(d =>
      [d.id, d.dealNumber ?? '', d.status, d.sellerOrgId, d.buyerOrgId, d.culture ?? '', d.cropClass ?? '', d.volumeTons ?? '', d.totalRub ?? '', d.currency, d.region ?? '', d.createdAt.toISOString(), d.closedAt?.toISOString() ?? '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n');
    return header + rows;
  }

  async exportEvidenceBundle(dealId: string, user: RequestUser): Promise<{
    manifest: object;
    files: Array<{ filename: string; hash: string; prevHash: string | null; type: string; uploadedAt: string }>;
    chainValid: boolean;
  }> {
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) throw new ForbiddenException(`Deal ${dealId} not found`);

    const evidence = await this.prisma.evidenceFile.findMany({
      where: { dealId },
      orderBy: { uploadedAt: 'asc' },
    });

    // Verify hash chain
    let chainValid = true;
    let prevHash = '';
    for (const e of evidence) {
      if (e.prevHash && e.prevHash !== prevHash) { chainValid = false; break; }
      prevHash = e.hash;
    }

    const files = evidence.map(e => ({
      id: e.id,
      filename: e.filename,
      type: e.type,
      mimeType: e.mimeType,
      sizeBytes: e.sizeBytes,
      hash: e.hash,
      prevHash: e.prevHash,
      uploadedBy: e.uploadedBy,
      uploadedAt: e.uploadedAt.toISOString(),
      s3Key: e.s3Key,
    }));

    const bundleHash = createHash('sha256')
      .update(JSON.stringify({ dealId, files: files.map(f => f.hash) }))
      .digest('hex');

    return {
      manifest: {
        dealId,
        exportedAt: new Date().toISOString(),
        exportedBy: user.id,
        bundleHash,
        fileCount: files.length,
        chainValid,
      },
      files,
      chainValid,
    };
  }

  async exportLedgerCsv(dealId: string, user: RequestUser): Promise<string> {
    this.assertExportRole(user);
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
    }).catch(() => []);
    const header = 'id,entryType,debitAccount,creditAccount,amountKopecks,currency,reference,idempotencyKey,createdAt\n';
    const rows = entries.map(e =>
      [e.id, e.entryType, e.debitAccount, e.creditAccount, e.amountKopecks, e.currency, e.reference ?? '', e.idempotencyKey, e.createdAt.toISOString()]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n');
    return header + rows;
  }

  async exportOutboxStatus(user: RequestUser): Promise<{ pending: number; sent: number; dead: number; failed: number; entries: unknown[] }> {
    this.assertExportRole(user);
    const entries = await this.prisma.outboxEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    }).catch(() => []);
    return {
      pending: entries.filter(e => e.status === 'PENDING').length,
      sent: entries.filter(e => e.status === 'SENT').length,
      dead: entries.filter(e => e.status === 'DEAD').length,
      failed: entries.filter(e => e.status === 'FAILED').length,
      entries: entries.slice(0, 100),
    };
  }
}
