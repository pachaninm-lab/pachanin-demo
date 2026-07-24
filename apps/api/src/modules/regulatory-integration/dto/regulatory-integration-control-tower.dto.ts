import { Type } from 'class-transformer';
import {
  IsEmpty,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { REGULATORY_INTEGRATION_STATES } from '../regulatory-integration.types';

export const INTEGRATION_HONEST_STATUSES = [
  'CONFIRMED_LIVE',
  'TEST',
  'ADAPTER_READY',
  'MANUAL',
  'UNAVAILABLE',
  'DEGRADED',
  'REVOKED',
] as const;

export const INTEGRATION_ENVIRONMENTS = [
  'SANDBOX',
  'TEST',
  'PREPROD',
  'PRODUCTION',
] as const;

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/;
const SAFE_ADAPTER_CODE = /^[A-Za-z0-9][A-Za-z0-9_.-]{1,63}$/;

/** Client-controlled authority is rejected instead of ignored. */
export class RegulatoryIntegrationForbiddenAuthorityDto {
  @IsOptional()
  @IsEmpty({ message: 'role is server-derived' })
  role?: never;

  @IsOptional()
  @IsEmpty({ message: 'tenantId is server-derived' })
  tenantId?: never;

  @IsOptional()
  @IsEmpty({ message: 'orgId is server-derived' })
  orgId?: never;

  @IsOptional()
  @IsEmpty({ message: 'organizationId is server-derived' })
  organizationId?: never;

  @IsOptional()
  @IsEmpty({ message: 'membershipId is server-derived' })
  membershipId?: never;

  @IsOptional()
  @IsEmpty({ message: 'hasJitAuthority is server-derived' })
  hasJitAuthority?: never;
}

export class RegulatoryIntegrationListQueryDto extends RegulatoryIntegrationForbiddenAuthorityDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  cursor?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_ADAPTER_CODE)
  adapterCode?: string;

  @IsOptional()
  @IsIn(INTEGRATION_HONEST_STATUSES)
  status?: (typeof INTEGRATION_HONEST_STATUSES)[number];

  @IsOptional()
  @IsIn(INTEGRATION_ENVIRONMENTS)
  environment?: (typeof INTEGRATION_ENVIRONMENTS)[number];

  @IsOptional()
  @IsIn(REGULATORY_INTEGRATION_STATES)
  state?: (typeof REGULATORY_INTEGRATION_STATES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  provider?: string;
}

export class RegulatoryIntegrationDetailQueryDto extends RegulatoryIntegrationForbiddenAuthorityDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  eventLimit?: number;

  @IsOptional()
  @IsIn(REGULATORY_INTEGRATION_STATES)
  state?: (typeof REGULATORY_INTEGRATION_STATES)[number];
}

export class ExecuteRegulatoryIntegrationCommandDto extends RegulatoryIntegrationForbiddenAuthorityDto {
  @IsString()
  @Matches(SAFE_ID)
  commandId!: string;

  @IsString()
  @Matches(SAFE_ID)
  idempotencyKey!: string;

  @IsString()
  @Matches(SAFE_ID)
  correlationId!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsEmpty({ message: 'expectedVersion must be supplied only through If-Match' })
  expectedVersion?: never;
}
