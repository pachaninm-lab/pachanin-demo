import { Type } from 'class-transformer';
import {
  IsEmpty,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const LIFECYCLES = ['DRAFT', 'REVIEW', 'APPROVED', 'EFFECTIVE', 'DEPRECATED', 'REVOKED'] as const;
const ARCHETYPES = [
  'DRY_BULK',
  'SEED_PLANTING',
  'ROOT_INDUSTRIAL',
  'FRESH_PACKED',
  'GREENHOUSE_RECURRING',
  'ORGANIC_EXPORT_QUARANTINE',
] as const;
const SOURCE_STATUSES = ['VERIFIED', 'REVERIFY_REQUIRED', 'BLOCKED_EXTERNAL'] as const;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$/;

/** Client-controlled authority inputs are explicit validation failures, never ignored. */
export class CommodityProfileForbiddenAuthorityDto {
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
  @IsEmpty({ message: 'membershipId is server-derived' })
  membershipId?: never;

  @IsOptional()
  @IsEmpty({ message: 'hasJitAuthority is server-derived' })
  hasJitAuthority?: never;
}

export class CommodityProfileListQueryDto extends CommodityProfileForbiddenAuthorityDto {
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
  @IsIn(LIFECYCLES)
  lifecycle?: (typeof LIFECYCLES)[number];

  @IsOptional()
  @IsIn(ARCHETYPES)
  archetype?: (typeof ARCHETYPES)[number];

  @IsOptional()
  @IsIn(SOURCE_STATUSES)
  sourceStatus?: (typeof SOURCE_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  effectiveAt?: string;
}

export class CommodityProfileDetailQueryDto extends CommodityProfileForbiddenAuthorityDto {
  @IsOptional()
  @IsString()
  @Matches(SAFE_ID)
  versionId?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  effectiveAt?: string;
}

export class CommodityProfileVersionHistoryQueryDto extends CommodityProfileForbiddenAuthorityDto {
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
}

export class ExecuteCommodityProfileCommandDto extends CommodityProfileForbiddenAuthorityDto {
  @IsString()
  @Matches(SAFE_ID)
  commandId!: string;

  @IsString()
  @Matches(SAFE_ID)
  idempotencyKey!: string;

  @IsString()
  @Matches(SAFE_ID)
  correlationId!: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_ID)
  profileVersionId?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsEmpty({ message: 'expectedVersion must be supplied only through If-Match' })
  expectedVersion?: never;
}
