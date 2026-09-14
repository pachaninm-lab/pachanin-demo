import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RequestUser } from '../../common/types/request-user';
import { calculateFounderControlOverview } from './founder-control.calculator';
import {
  FOUNDER_CONTROL_ASSUMPTIONS,
  FOUNDER_CONTROL_BASE_FINANCIALS,
  FOUNDER_CONTROL_BASE_PLAN,
  FOUNDER_CONTROL_EVIDENCE_REQUIREMENTS,
  FOUNDER_CONTROL_REFERENCE_VERSION,
  FOUNDER_CONTROL_REFERENCE_ARTIFACT,
  FOUNDER_CONTROL_TYPES,
  FOUNDER_CONTROL_WORKBOOK_PARITY,
} from './founder-control.reference';
import { FounderControlRepository, FounderControlRepositoryError } from './founder-control.repository';
import { StaffAccessService } from '../staff-access/staff-access.service';
import { StaffPermission } from '../staff-access/staff-access.types';
import { FOUNDER_CONTROL_RECORD_TYPES, type FounderControlMutationCommand, type FounderControlRecordType } from './founder-control.types';

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clean(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit) : '';
}

function validRecordType(value: string): value is FounderControlRecordType {
  return (FOUNDER_CONTROL_RECORD_TYPES as readonly string[]).includes(value);
}

@Injectable()
export class FounderControlService {
  constructor(
    private readonly repository: FounderControlRepository,
    private readonly staffAccess: StaffAccessService,
  ) {}

  private async requireReadAuthority(user: RequestUser) {
    if (user.mfaVerified !== true) throw new ForbiddenException('Founder control requires MFA.');
    await this.staffAccess.requirePermission(user, StaffPermission.FOUNDER_CONTROL_READ);
  }

  private async requireWriteAuthority(user: RequestUser) {
    if (user.mfaVerified !== true || !user.mfaVerifiedAt) throw new ForbiddenException('Founder control write requires recent MFA.');
    const age = Date.now() - new Date(user.mfaVerifiedAt).getTime();
    if (!Number.isFinite(age) || age < 0 || age > 15 * 60 * 1000) {
      throw new ForbiddenException('Founder control write requires MFA verified within the last 15 minutes.');
    }
    await this.staffAccess.requirePermission(user, StaffPermission.FOUNDER_CONTROL_WRITE);
  }

  async spec(user: RequestUser) {
    await this.requireReadAuthority(user);
    return Object.freeze({
      referenceVersion: FOUNDER_CONTROL_REFERENCE_VERSION,
      referenceArtifact: FOUNDER_CONTROL_REFERENCE_ARTIFACT,
      assumptions: FOUNDER_CONTROL_ASSUMPTIONS,
      baseFinancials: FOUNDER_CONTROL_BASE_FINANCIALS,
      basePlan: FOUNDER_CONTROL_BASE_PLAN,
      evidenceRequirements: FOUNDER_CONTROL_EVIDENCE_REQUIREMENTS,
      recordTypes: FOUNDER_CONTROL_TYPES,
      workbookParity: FOUNDER_CONTROL_WORKBOOK_PARITY,
    });
  }

  async overview(user: RequestUser) {
    await this.requireReadAuthority(user);
    const records = await this.repository.list(user);
    return calculateFounderControlOverview(records);
  }

  async list(user: RequestUser, recordType?: string) {
    await this.requireReadAuthority(user);
    if (!recordType) return this.repository.list(user);
    if (!validRecordType(recordType)) throw new BadRequestException('Unknown founder-control recordType.');
    return this.repository.list(user, recordType);
  }

  async events(user: RequestUser, limit?: number) {
    await this.requireReadAuthority(user);
    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(Number(limit), 1), 200) : 50;
    return this.repository.events(user, safeLimit);
  }

  async upsert(
    user: RequestUser,
    recordTypeRaw: string,
    recordKeyRaw: string,
    body: unknown,
    idempotencyKeyRaw: string | undefined,
    correlationIdRaw: string | undefined,
  ) {
    await this.requireWriteAuthority(user);
    if (!validRecordType(recordTypeRaw)) throw new BadRequestException('Unknown founder-control recordType.');
    const recordKey = clean(recordKeyRaw, 160);
    if (!recordKey) throw new BadRequestException('recordKey is required.');
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(recordKey)) throw new BadRequestException('recordKey must use only A-Z, a-z, 0-9, dot, underscore, colon or hyphen.');
    if (!isObject(body)) throw new BadRequestException('JSON object body is required.');
    const payload = body.payload;
    if (!isObject(payload)) throw new BadRequestException('payload must be a JSON object.');
    const serialized = JSON.stringify(payload);
    if (Buffer.byteLength(serialized, 'utf8') > 64 * 1024) throw new BadRequestException('payload exceeds 64 KiB.');
    const reason = clean(body.reason, 500);
    if (!reason) throw new BadRequestException('reason is required.');
    const idempotencyKey = clean(idempotencyKeyRaw, 180);
    if (!idempotencyKey) throw new BadRequestException('Idempotency-Key header is required.');
    const correlationId = clean(correlationIdRaw, 180) || `founder-${randomUUID()}`;
    const expectedVersion = clean(body.expectedVersion, 30) || '0';
    if (!/^\d+$/.test(expectedVersion)) throw new BadRequestException('expectedVersion must be a non-negative integer string.');
    const status = body.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';
    const source = clean(body.source, 80) || 'MANUAL';
    const command: FounderControlMutationCommand = {
      recordType: recordTypeRaw,
      recordKey,
      payload,
      status,
      source,
      reason,
      expectedVersion,
      idempotencyKey,
      correlationId,
    };
    try {
      return await this.repository.upsert(user, command);
    } catch (error) {
      if (error instanceof FounderControlRepositoryError) throw new ConflictException(error.message);
      throw error;
    }
  }
}
