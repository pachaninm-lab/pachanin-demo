import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';

const ALLOWED_ROLES: Role[] = [Role.ADMIN, Role.ACCOUNTING, Role.EXECUTIVE];

/**
 * Bank reconciliation on PostgreSQL.
 *
 * Invariants:
 *  - imported statement rows are immutable evidence (DB trigger blocks any
 *    content change and every DELETE); only the match verdict may change;
 *  - import is idempotent: a row's contentHash is unique, re-importing the
 *    same statement adds nothing and reports duplicates honestly;
 *  - a persisted cursor (reconciliation_cursors) survives restarts and is
 *    shared by every API instance;
 *  - a reconciliation MISMATCH can only ever mark rows for manual review —
 *    this module has no code path that touches payments, deals or the ledger;
 *  - there is no demo fallback: content that parses to zero rows imports zero
 *    rows.
 */

interface ParsedStatementRow {
  lineNo: number;
  statementDate: string | null;
  valueDate: string | null;
  amountKopecks: bigint;
  reference: string;
  counterpartyName: string | null;
  counterpartyInn: string | null;
  counterpartyAccount: string | null;
  description: string | null;
  contentHash: string;
}

export interface ImportResult {
  runId: string;
  batchId: string;
  imported: number;
  duplicates: number;
  matched: number;
  mismatched: number;
  unmatched: number;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseKopecksFromDecimal(raw: string): bigint {
  const normalized = raw.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new BadRequestException(`Некорректная сумма в выписке: ${raw}`);
  }
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

@Injectable()
export class BankReconciliationService {
  private readonly logger = new Logger(BankReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  private assertRole(user: RequestUser): void {
    if (!ALLOWED_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Доступ к банковской сверке ограничен');
    }
  }

  private assertCanMutate(user: RequestUser): void {
    this.assertRole(user);
    if (user.role === Role.EXECUTIVE) {
      throw new ForbiddenException('Руководитель имеет доступ к сверке только на чтение');
    }
  }

  async importMT940(content: string, user: RequestUser): Promise<ImportResult> {
    this.assertCanMutate(user);
    const trimmed = String(content ?? '').trim();
    if (!trimmed) throw new BadRequestException('Пустая выписка не может быть импортирована.');

    const batchId = `BATCH-${randomUUID()}`;
    const statementSha256 = sha256(trimmed);
    const rows = this.parseMT940(trimmed);

    let imported = 0;
    let duplicates = 0;
    let matched = 0;
    let mismatched = 0;

    for (const row of rows) {
      const verdict = await this.matchAgainstBankOperations(row);
      try {
        await this.prisma.bankStatementEntry.create({
          data: {
            importBatchId: batchId,
            source: 'MT940',
            lineNo: row.lineNo,
            statementDate: row.statementDate ? new Date(row.statementDate) : null,
            valueDate: row.valueDate ? new Date(row.valueDate) : null,
            amountKopecks: row.amountKopecks,
            reference: row.reference,
            counterpartyName: row.counterpartyName,
            counterpartyInn: row.counterpartyInn,
            counterpartyAccount: row.counterpartyAccount,
            description: row.description,
            contentHash: row.contentHash,
            matchStatus: verdict.status,
            matchedDealId: verdict.dealId,
            matchedBankOperationId: verdict.bankOperationId,
            mismatchReason: verdict.mismatchReason,
            matchedAt: verdict.status === 'MATCHED' ? new Date() : null,
          },
        });
        imported += 1;
        if (verdict.status === 'MATCHED') matched += 1;
        if (verdict.status === 'MISMATCH') mismatched += 1;
      } catch (error) {
        if ((error as { code?: string })?.code === 'P2002') {
          duplicates += 1; // same statement row already imported earlier
          continue;
        }
        throw error;
      }
    }

    const unmatched = imported - matched - mismatched;
    const run = await this.prisma.reconciliationRun.create({
      data: {
        source: 'MT940',
        importBatchId: batchId,
        statementSha256,
        importedCount: imported,
        duplicateCount: duplicates,
        matchedCount: matched,
        mismatchCount: mismatched,
        unmatchedCount: unmatched,
        status: mismatched > 0 ? 'MANUAL_REVIEW_REQUIRED' : 'COMPLETED',
        startedByUserId: user.id,
        finishedAt: new Date(),
      },
    });

    const latestValueDate = rows
      .map((row) => row.valueDate)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
    await this.prisma.reconciliationCursor.upsert({
      where: { source: 'MT940' },
      update: {
        lastValueDate: latestValueDate ? new Date(latestValueDate) : undefined,
        lastRunId: run.id,
        lastStatementSha256: statementSha256,
      },
      create: {
        source: 'MT940',
        lastValueDate: latestValueDate ? new Date(latestValueDate) : null,
        lastRunId: run.id,
        lastStatementSha256: statementSha256,
      },
    });

    this.logger.log(
      `Reconciliation run ${run.id}: imported=${imported} duplicates=${duplicates} matched=${matched} mismatch=${mismatched}`,
    );
    return { runId: run.id, batchId, imported, duplicates, matched, mismatched, unmatched };
  }

  /**
   * Match a statement row against platform-issued bank operations.
   * Exact bankRef + exact amount → MATCHED. Same bankRef with a different
   * amount → MISMATCH (manual review; money never moves from here).
   */
  private async matchAgainstBankOperations(row: ParsedStatementRow): Promise<{
    status: 'MATCHED' | 'MISMATCH' | 'UNMATCHED';
    dealId: string | null;
    bankOperationId: string | null;
    mismatchReason: string | null;
  }> {
    const operation = await this.prisma.bankOperation.findFirst({
      where: { bankRef: row.reference },
      select: { id: true, dealId: true, amountKopecks: true, status: true },
    });
    if (!operation) return { status: 'UNMATCHED', dealId: null, bankOperationId: null, mismatchReason: null };

    if (BigInt(operation.amountKopecks) !== row.amountKopecks) {
      return {
        status: 'MISMATCH',
        dealId: operation.dealId,
        bankOperationId: operation.id,
        mismatchReason: `Сумма в выписке ${row.amountKopecks} коп. не совпадает с операцией ${operation.amountKopecks} коп.`,
      };
    }
    return { status: 'MATCHED', dealId: operation.dealId, bankOperationId: operation.id, mismatchReason: null };
  }

  private parseMT940(content: string): ParsedStatementRow[] {
    const rows: ParsedStatementRow[] = [];
    const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);

    let statementDate: string | null = null;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];

      if (line.startsWith(':60F:') || line.startsWith(':60M:')) {
        const dateStr = line.slice(5, 11);
        if (/^\d{6}$/.test(dateStr)) {
          statementDate = `20${dateStr.slice(0, 2)}-${dateStr.slice(2, 4)}-${dateStr.slice(4, 6)}`;
        }
        continue;
      }

      if (!line.startsWith(':61:')) continue;

      const rest = line.slice(4);
      const match = rest.match(/^(\d{6})(\d{4})?(C|D)(RD?|CR?)?(\d+,?\d*)(N\w{3})?(\S+)?/);
      if (!match) continue;

      const valueDate = `20${rest.slice(0, 2)}-${rest.slice(2, 4)}-${rest.slice(4, 6)}`;
      const amountKopecks = parseKopecksFromDecimal(match[5] ?? '0');
      const reference = (match[7] ?? '').trim();
      if (!reference) continue; // a row without a bank reference cannot be reconciled

      let description: string | null = null;
      let counterpartyName: string | null = null;
      let counterpartyInn: string | null = null;
      let counterpartyAccount: string | null = null;
      if (lines[i + 1]?.startsWith(':86:')) {
        description = lines[i + 1].slice(4);
        counterpartyInn = description.match(/ИНН[:\s]*(\d{10,12})/)?.[1] ?? null;
        counterpartyName = description.match(/(?:Плательщик|Получатель)[:\s]*([^|/\\]+)/)?.[1]?.trim() ?? null;
        counterpartyAccount = description.match(/р[/]?с[:\s]*(\d{20})/)?.[1] ?? null;
        i += 1;
      }

      rows.push({
        lineNo: rows.length + 1,
        statementDate,
        valueDate,
        amountKopecks,
        reference,
        counterpartyName,
        counterpartyInn,
        counterpartyAccount,
        description,
        // The full source line pair is the identity of the evidence row.
        contentHash: sha256(`${line}\n${description ?? ''}`),
      });
    }

    return rows;
  }

  async manualMatch(entryId: string, dealId: string, user: RequestUser) {
    this.assertCanMutate(user);
    const entry = await this.prisma.bankStatementEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundException(`Строка выписки ${entryId} не найдена`);
    if (entry.matchStatus === 'MATCHED') {
      throw new BadRequestException('Строка уже сверена автоматически и не подлежит ручной перепривязке.');
    }
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId }, select: { id: true } });
    if (!deal) throw new NotFoundException(`Сделка ${dealId} не найдена`);

    const updated = await this.prisma.bankStatementEntry.update({
      where: { id: entryId },
      data: {
        matchStatus: 'MANUAL',
        matchedDealId: dealId,
        matchedAt: new Date(),
        matchedByUserId: user.id,
      },
    });
    return { ...updated, amountKopecks: updated.amountKopecks.toString() };
  }

  async listUnmatched(user: RequestUser, take = 100) {
    this.assertRole(user);
    const entries = await this.prisma.bankStatementEntry.findMany({
      where: { matchStatus: { in: ['UNMATCHED', 'MISMATCH'] } },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(take, 1), 500),
    });
    return entries.map((entry) => ({ ...entry, amountKopecks: entry.amountKopecks.toString() }));
  }

  async getReport(user: RequestUser, params?: { from?: string; to?: string }) {
    this.assertRole(user);
    const from = params?.from ? new Date(params.from) : new Date(Date.now() - 30 * 24 * 3600_000);
    const to = params?.to ? new Date(params.to) : new Date();

    const [entries, cursor, lastRuns] = await Promise.all([
      this.prisma.bankStatementEntry.findMany({
        where: { createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: 'asc' },
        take: 1000,
      }),
      this.prisma.reconciliationCursor.findUnique({ where: { source: 'MT940' } }),
      this.prisma.reconciliationRun.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);

    const sum = (filter: (entry: (typeof entries)[number]) => boolean) =>
      entries.filter(filter).reduce((acc, entry) => acc + BigInt(entry.amountKopecks), 0n);

    const matched = entries.filter((entry) => entry.matchStatus === 'MATCHED' || entry.matchStatus === 'MANUAL');
    const mismatched = entries.filter((entry) => entry.matchStatus === 'MISMATCH');
    const unmatched = entries.filter((entry) => entry.matchStatus === 'UNMATCHED');

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      cursor,
      runs: lastRuns,
      totalImported: entries.length,
      totalMatched: matched.length,
      totalMismatched: mismatched.length,
      totalUnmatched: unmatched.length,
      matchedAmountKopecks: sum((entry) => entry.matchStatus === 'MATCHED' || entry.matchStatus === 'MANUAL').toString(),
      mismatchedAmountKopecks: sum((entry) => entry.matchStatus === 'MISMATCH').toString(),
      unmatchedAmountKopecks: sum((entry) => entry.matchStatus === 'UNMATCHED').toString(),
      payments: entries.map((entry) => ({ ...entry, amountKopecks: entry.amountKopecks.toString() })),
    };
  }
}
