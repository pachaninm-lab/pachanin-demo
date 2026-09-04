import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RequestUser } from '../../common/types/request-user';
import {
  requireOrganizationCapabilityCode,
} from './organization-capability.registry';
import { OrganizationCapabilityRepository } from './organization-capability.repository';
import type {
  OrganizationCapabilityIntent,
  OrganizationCapabilityMutationBody,
  OrganizationCapabilityMutationResult,
  OrganizationCapabilityRecord,
} from './organization-capability.types';

@Injectable()
export class OrganizationCapabilityService {
  constructor(private readonly repository: OrganizationCapabilityRepository) {}

  list(user: RequestUser): Promise<OrganizationCapabilityRecord[]> {
    return this.repository.list(user);
  }

  mutate(
    rawCapabilityCode: string,
    body: OrganizationCapabilityMutationBody,
    user: RequestUser,
  ): Promise<OrganizationCapabilityMutationResult> {
    let capabilityCode;
    try {
      capabilityCode = requireOrganizationCapabilityCode(rawCapabilityCode);
    } catch {
      throw new BadRequestException({ code: 'ORGANIZATION_CAPABILITY_CODE_UNSUPPORTED' });
    }

    const intent = requireIntent(body.intent);
    const expectedVersion = requireExpectedVersion(body.expectedVersion);
    const idempotencyKey = requireIdentifier(
      body.idempotencyKey,
      'ORGANIZATION_CAPABILITY_IDEMPOTENCY_KEY_INVALID',
    );
    const correlationId = body.correlationId === undefined
      ? `org-cap-${randomUUID()}`
      : requireIdentifier(body.correlationId, 'ORGANIZATION_CAPABILITY_CORRELATION_ID_INVALID');

    return this.repository.mutate(
      {
        capabilityCode,
        intent,
        expectedVersion,
        idempotencyKey,
        correlationId,
      },
      user,
    );
  }
}

function requireIntent(value: unknown): OrganizationCapabilityIntent {
  if (value !== 'ENABLE' && value !== 'DISABLE') {
    throw new BadRequestException({ code: 'ORGANIZATION_CAPABILITY_INTENT_INVALID' });
  }
  return value;
}

function requireExpectedVersion(value: unknown): bigint {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new BadRequestException({ code: 'ORGANIZATION_CAPABILITY_EXPECTED_VERSION_INVALID' });
    }
    return BigInt(value);
  }
  if (typeof value === 'string' && /^(0|[1-9][0-9]{0,18})$/.test(value)) {
    return BigInt(value);
  }
  throw new BadRequestException({ code: 'ORGANIZATION_CAPABILITY_EXPECTED_VERSION_INVALID' });
}

function requireIdentifier(value: unknown, code: string): string {
  if (typeof value !== 'string') throw new BadRequestException({ code });
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(normalized)) {
    throw new BadRequestException({ code });
  }
  return normalized;
}
