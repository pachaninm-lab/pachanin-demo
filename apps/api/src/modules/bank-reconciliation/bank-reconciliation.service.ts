import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';

const READ_ROLES: Set<Role> = new Set([
  Role.ADMIN,
  Role.ACCOUNTING,
  Role.EXECUTIVE,
  Role.SUPPORT_MANAGER,
  Role.COMPLIANCE_OFFICER,
]);
const MUTATE_ROLES: Set<Role> = new Set([Role.ADMIN, Role.ACCOUNTING]);
const MAX_STATEMENT_BYTES = 5 * 1024 * 1024;

export type ReconciliationMatchStatus = 'MATCHED' | 'UNMATCHED' | 'MISMATCH' | 'MANUAL';

export interface BankReconciliationRecord {
  id: string;
  batchId: string;
  reference: string;
  valueDate: string;
  amountKopecks: number;
  currency: string;
  matchStatus: ReconciliationMatchStatus;
  paymentId?: string;
  dealId?: string;
  mismatchCode?: string;
  evidenceHash: string;
  createdAt: string;
  manualDecisionId?: number;
}

export interface ReconciliationReport {
  period: { from: string; to: string };
  partnerId: string;
  totalImported: number;
  totalMatched: number;
  totalUnmatched: number;
  matchedAmountKopecks: number;
  unmatchedAmountKopecks: number;
  batchCount: number;
  latestCheckpointCursor?: string;
  checkpointVersion: number;
}

type ParsedRecord = {
  id: string;
  externalRef: string;
  valueDate: string;
  amountKopecks: string;
  currency: string;
  counterpartyHash: string;
  descriptionHash: string;
  rawHash: string;
  matchStatus: 'MATCHED' | 'UNMATCHED' | 'MISMATCH';
  paymentId: string;
  dealId: string;
  mismatchCode: string;
  evidenceHash: string;
};

type BatchRow = {
  batch_id: string;
  duplicate: boolean;
  imported_count: number;
  matched_count: number;
  mismatch_count: number;
  checkpoint_version: bigint;
};

type RecordRow = {
  id: string;
  batch_id: string;
  external_ref: string;
  value_date: Date;
  amount_kopecks: bigint;
  currency: string;
  match_status: ReconciliationMatchStatus;
  payment_id: string | null;
  deal_id: string | null;
  mismatch_code: string | null;
  evidence_hash: string;
  created_at: Date;
  manual_decision_id: bigint | null;
};

type ReportRow = {
  total_imported: bigint;
  total_matched: bigint;
  total_unmatched: bigint;
  matched_amount_kopecks: Prisma.Decimal;
  unmatched_amount_kopecks: Prisma.Decimal;
  batch_count: bigint;
  latest_checkpoint_cursor: string | null;
  checkpoint_version: bigint | null;
};

@Injectable()
export class BankReconciliationService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    if (String(process.env.NODE_ENV ?? '').toLowerCase() !== 'production') return;
    const rows = await this.prisma.$queryRaw<Array<{
      can_import: boolean;
      can_match: boolean;
      can_list: boolean;
      can_report: boolean;
      can_read_tables: boolean;
    }>>(Prisma.sql`
      SELECT
        has_function_privilege(current_user, 'reconciliation.record_statement_batch(text,text,text,text,jsonb)', 'EXECUTE') AS can_import,
        has_function_privilege(current_user, 'reconciliation.record_manual_match(text,text,text,text)', 'EXECUTE') AS can_match,
        has_function_privilege(current_user, 'reconciliation.list_statement_records(text,timestamptz,timestamptz,boolean,integer,integer)', 'EXECUTE') AS can_list,
        has_function_privilege(current_user, 'reconciliation.get_reconciliation_report(text,timestamptz,timestamptz)', 'EXECUTE') AS can_report,
        has_table_privilege(current_user, 'reconciliation.statement_records', 'SELECT')
          OR has_table_privilege(current_user, 'reconciliation.statement_batches', 'SELECT')
          OR has_table_privilege(current_user, 'reconciliation.manual_match_decisions', 'SELECT')
          OR has_table_privilege(current_user, 'reconciliation.checkpoints', 'SELECT') AS can_read_tables
    `);
    const row = rows[0];
    if (!row || !row.can_import || !row.can_match || !row.can_list || !row.can_report || row.can_read_tables) {
      throw new Error('Durable reconciliation function boundary is not ready for production enforcement.');
    }
  }

  async importMT940(
    content: string,
    user: RequestUser,
    input: { partnerId: string; cursor: string },
  ): Promise<{
    batchId: string;
    duplicate: boolean;
    imported: number;
    matched: number;
    mismatch: number;
    checkpointVersion: number;
    statementHash: string;
  }> {
    this.assertMutate(user);
    const partnerId = normalizedToken(input.partnerId, 'partnerId', 96);
    const cursor = normalizedToken(input.cursor, 'cursor', 240);
    const normalizedStatement = normalizeStatement(content);
    const statementHash = sha256(normalizedStatement);
    const parsed = parseMt940(normalizedStatement, partnerId, statementHash);
    const matched = await Promise.all(parsed.map((record) => this.matchRecord(record, statementHash)));
    const rows = await this.prisma.$queryRaw<BatchRow[]>(Prisma.sql`
      SELECT *
      FROM reconciliation.record_statement_batch(
        ${partnerId}::text,
        ${cursor}::text,
        ${statementHash}::text,
        ${normalizedToken(user.id, 'actor user id', 160)}::text,
        ${JSON.stringify(matched)}::jsonb
      )
    `);
    const row = rows[0];
    if (!row) throw new Error('RECONCILIATION_IMPORT_EMPTY_RESULT');
    return {
      batchId: row.batch_id,
      duplicate: Boolean(row.duplicate),
      imported: Number(row.imported_count),
      matched: Number(row.matched_count),
      mismatch: Number(row.mismatch_count),
      checkpointVersion: Number(row.checkpoint_version),
      statementHash,
    };
  }

  async manualMatch(
    recordId: string,
    dealId: string,
    reason: string,
    user: RequestUser,
  ): Promise<{ recordId: string; dealId: string; decisionId: number; moneyMutated: false }> {
    this.assertMutate(user);
    const normalizedReason = String(reason ?? '').trim();
    if (normalizedReason.length < 5 || normalizedReason.length > 2000) {
      throw new Error('RECONCILIATION_REASON_REQUIRED');
    }
    const rows = await this.prisma.$queryRaw<Array<{ decision_id: bigint }>>(Prisma.sql`
      SELECT reconciliation.record_manual_match(
        ${normalizedToken(recordId, 'record id', 96)}::text,
        ${normalizedToken(dealId, 'deal id', 160)}::text,
        ${normalizedToken(user.id, 'actor user id', 160)}::text,
        ${sha256(normalizedReason)}::text
      ) AS decision_id
    `);
    const decisionId = rows[0]?.decision_id;
    if (decisionId === undefined) throw new Error('RECONCILIATION_MANUAL_MATCH_FAILED');
    return { recordId, dealId, decisionId: Number(decisionId), moneyMutated: false };
  }

  async listUnmatched(
    user: RequestUser,
    input: { partnerId: string; limit?: number; offset?: number },
  ): Promise<BankReconciliationRecord[]> {
    this.assertRead(user);
    return this.listRecords({
      partnerId: input.partnerId,
      unmatchedOnly: true,
      limit: input.limit,
      offset: input.offset,
    });
  }

  async listRecords(input: {
    partnerId: string;
    from?: string;
    to?: string;
    unmatchedOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<BankReconciliationRecord[]> {
    const partnerId = normalizedToken(input.partnerId, 'partnerId', 96);
    const from = optionalDate(input.from, 'from');
    const to = optionalDate(input.to, 'to');
    if (from && to && from > to) throw new Error('RECONCILIATION_PERIOD_INVALID');
    const rows = await this.prisma.$queryRaw<RecordRow[]>(Prisma.sql`
      SELECT *
      FROM reconciliation.list_statement_records(
        ${partnerId}::text,
        ${from}::timestamptz,
        ${to}::timestamptz,
        ${Boolean(input.unmatchedOnly)}::boolean,
        ${boundedInteger(input.limit ?? 200, 1, 1000, 'limit')}::integer,
        ${boundedInteger(input.offset ?? 0, 0, 1_000_000, 'offset')}::integer
      )
    `);
    return rows.map(toApiRecord);
  }

  async getReport(
    user: RequestUser,
    input: { partnerId: string; from?: string; to?: string },
  ): Promise<ReconciliationReport> {
    this.assertRead(user);
    const partnerId = normalizedToken(input.partnerId, 'partnerId', 96);
    const from = optionalDate(input.from, 'from') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = optionalDate(input.to, 'to') ?? new Date();
    if (from > to) throw new Error('RECONCILIATION_PERIOD_INVALID');
    const rows = await this.prisma.$queryRaw<ReportRow[]>(Prisma.sql`
      SELECT *
      FROM reconciliation.get_reconciliation_report(
        ${partnerId}::text,
        ${from}::timestamptz,
        ${to}::timestamptz
      )
    `);
    const row = rows[0];
    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      partnerId,
      totalImported: Number(row?.total_imported ?? 0n),
      totalMatched: Number(row?.total_matched ?? 0n),
      totalUnmatched: Number(row?.total_unmatched ?? 0n),
      matchedAmountKopecks: decimalToSafeInteger(row?.matched_amount_kopecks),
      unmatchedAmountKopecks: decimalToSafeInteger(row?.unmatched_amount_kopecks),
      batchCount: Number(row?.batch_count ?? 0n),
      latestCheckpointCursor: row?.latest_checkpoint_cursor ?? undefined,
      checkpointVersion: Number(row?.checkpoint_version ?? 0n),
    };
  }

  private async matchRecord(record: ParsedRecord, statementHash: string): Promise<ParsedRecord> {
    if (record.mismatchCode === 'MISSING_REFERENCE') {
      return withEvidence(record, statementHash);
    }
    const payments = await this.prisma.payment.findMany({
      where: { bankRef: record.externalRef },
      select: { id: true, dealId: true, amountRub: true },
      take: 2,
    });
    if (payments.length === 0) {
      return withEvidence({ ...record, matchStatus: 'UNMATCHED', mismatchCode: 'REFERENCE_NOT_FOUND' }, statementHash);
    }
    if (payments.length > 1) {
      return withEvidence({ ...record, matchStatus: 'MISMATCH', mismatchCode: 'AMBIGUOUS_REFERENCE' }, statementHash);
    }
    const payment = payments[0];
    const expectedKopecks = payment.amountRub === null || payment.amountRub === undefined
      ? null
      : Math.round(Number(payment.amountRub) * 100);
    if (expectedKopecks === null) {
      return withEvidence({
        ...record,
        matchStatus: 'MISMATCH',
        paymentId: payment.id,
        dealId: payment.dealId,
        mismatchCode: 'PAYMENT_AMOUNT_UNAVAILABLE',
      }, statementHash);
    }
    if (Math.abs(expectedKopecks) !== Math.abs(Number(record.amountKopecks))) {
      return withEvidence({
        ...record,
        matchStatus: 'MISMATCH',
        paymentId: payment.id,
        dealId: payment.dealId,
        mismatchCode: 'AMOUNT_MISMATCH',
      }, statementHash);
    }
    return withEvidence({
      ...record,
      matchStatus: 'MATCHED',
      paymentId: payment.id,
      dealId: payment.dealId,
      mismatchCode: '',
    }, statementHash);
  }

  private assertRead(user: RequestUser): void {
    if (!READ_ROLES.has(user.role)) throw new ForbiddenException('Доступ к банковской сверке ограничен');
  }

  private assertMutate(user: RequestUser): void {
    if (!MUTATE_ROLES.has(user.role)) throw new ForbiddenException('Изменение банковской сверки ограничено');
  }
}

function normalizeStatement(content: string): string {
  const raw = String(content ?? '');
  const bytes = Buffer.byteLength(raw, 'utf8');
  if (bytes < 1 || bytes > MAX_STATEMENT_BYTES || raw.includes('\u0000')) {
    throw new Error('MT940_STATEMENT_SIZE_INVALID');
  }
  return raw.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trimEnd()).join('\n').trim();
}

function parseMt940(content: string, partnerId: string, statementHash: string): ParsedRecord[] {
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.some((line) => line.startsWith(':20:'))
    || !lines.some((line) => line.startsWith(':60F:') || line.startsWith(':60M:'))
    || !lines.some((line) => line.startsWith(':62F:') || line.startsWith(':62M:'))) {
    throw new Error('MT940_REQUIRED_TAGS_MISSING');
  }

  const records: ParsedRecord[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith(':61:')) continue;
    const match = line.match(/^:61:(\d{6})(?:\d{4})?([CD])([A-Z]{0,2})(\d+(?:,\d{1,2})?)([A-Z0-9]{4})(.*)$/);
    if (!match) throw new Error(`MT940_TRANSACTION_INVALID_AT_${index + 1}`);
    const valueDate = parseYyMmDd(match[1]);
    const amount = parseAmountKopecks(match[4]);
    const signedAmount = match[2] === 'D' ? -amount : amount;
    const rawReference = match[6].replace(/^\/+/, '').trim();
    const transactionCode = match[5];

    const narrative: string[] = [];
    let cursor = index + 1;
    if (lines[cursor]?.startsWith(':86:')) {
      narrative.push(lines[cursor].slice(4));
      cursor += 1;
      while (cursor < lines.length && !lines[cursor].startsWith(':')) {
        narrative.push(lines[cursor]);
        cursor += 1;
      }
      index = cursor - 1;
    }
    const description = narrative.join(' ').trim();
    const rawHash = sha256(`${line}\n${description}`);
    const missingReference = !rawReference || rawReference === 'NONREF';
    const externalRef = missingReference ? `missing-${rawHash.slice(0, 32)}` : rawReference.slice(0, 240);
    const recordId = `recon_${sha256(`${partnerId}:${statementHash}:${records.length}:${rawHash}`)}`;
    const counterpartyIdentity = extractCounterpartyIdentity(description);
    const base: ParsedRecord = {
      id: recordId,
      externalRef,
      valueDate,
      amountKopecks: String(signedAmount),
      currency: 'RUB',
      counterpartyHash: counterpartyIdentity ? sha256(counterpartyIdentity) : '',
      descriptionHash: sha256(description),
      rawHash,
      matchStatus: missingReference ? 'MISMATCH' : 'UNMATCHED',
      paymentId: '',
      dealId: '',
      mismatchCode: missingReference ? 'MISSING_REFERENCE' : '',
      evidenceHash: '',
    };
    records.push(withEvidence({ ...base, mismatchCode: base.mismatchCode || `UNMATCHED_${transactionCode}` }, statementHash));
  }

  if (records.length === 0) throw new Error('MT940_NO_TRANSACTIONS');
  return records;
}

function parseYyMmDd(value: string): string {
  const year = 2000 + Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('MT940_DATE_INVALID');
  }
  return date.toISOString().slice(0, 10);
}

function parseAmountKopecks(value: string): number {
  const normalized = value.replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error('MT940_AMOUNT_INVALID');
  const [rublesPart, kopecksPart = ''] = normalized.split('.');
  const kopecks = Number(rublesPart) * 100 + Number(kopecksPart.padEnd(2, '0'));
  if (!Number.isSafeInteger(kopecks) || kopecks < 1) throw new Error('MT940_AMOUNT_OUT_OF_RANGE');
  return kopecks;
}

function extractCounterpartyIdentity(description: string): string {
  const inn = description.match(/(?:ИНН|INN)[:\s]*(\d{10,12})/i)?.[1] ?? '';
  const account = description.match(/(?:р\/?с|account)[:\s]*(\d{20})/i)?.[1] ?? '';
  return [inn, account].filter(Boolean).join(':');
}

function withEvidence(record: ParsedRecord, statementHash: string): ParsedRecord {
  return {
    ...record,
    evidenceHash: sha256(JSON.stringify({
      statementHash,
      id: record.id,
      externalRef: record.externalRef,
      valueDate: record.valueDate,
      amountKopecks: record.amountKopecks,
      currency: record.currency,
      rawHash: record.rawHash,
      matchStatus: record.matchStatus,
      paymentId: record.paymentId,
      dealId: record.dealId,
      mismatchCode: record.mismatchCode,
    })),
  };
}

function toApiRecord(row: RecordRow): BankReconciliationRecord {
  const amount = Number(row.amount_kopecks);
  if (!Number.isSafeInteger(amount)) throw new Error('RECONCILIATION_AMOUNT_OUT_OF_RANGE');
  return {
    id: row.id,
    batchId: row.batch_id,
    reference: row.external_ref,
    valueDate: row.value_date.toISOString().slice(0, 10),
    amountKopecks: amount,
    currency: row.currency,
    matchStatus: row.match_status,
    paymentId: row.payment_id ?? undefined,
    dealId: row.deal_id ?? undefined,
    mismatchCode: row.mismatch_code ?? undefined,
    evidenceHash: row.evidence_hash,
    createdAt: row.created_at.toISOString(),
    manualDecisionId: row.manual_decision_id === null ? undefined : Number(row.manual_decision_id),
  };
}

function normalizedToken(value: unknown, name: string, maxLength: number): string {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error(`RECONCILIATION_${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_INVALID`);
  }
  return normalized;
}

function optionalDate(value: string | undefined, name: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`RECONCILIATION_${name.toUpperCase()}_INVALID`);
  return date;
}

function boundedInteger(value: number, min: number, max: number, name: string): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`RECONCILIATION_${name.toUpperCase()}_INVALID`);
  }
  return value;
}

function decimalToSafeInteger(value: Prisma.Decimal | undefined): number {
  if (!value) return 0;
  const numberValue = Number(value.toString());
  if (!Number.isSafeInteger(numberValue)) throw new Error('RECONCILIATION_TOTAL_OUT_OF_RANGE');
  return numberValue;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
