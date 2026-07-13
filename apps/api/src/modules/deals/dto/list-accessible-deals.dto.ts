import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Role } from '../../../common/types/request-user';

export const DEAL_REGISTRY_STATUSES = [
  'DRAFT',
  'ADMISSION_APPROVED',
  'AUCTION_OPEN',
  'AUCTION_WON',
  'SELLER_SIGNED',
  'CONTRACT_SIGNED',
  'RESERVE_REQUESTED',
  'RESERVED',
  'LOGISTICS_ASSIGNED',
  'LOADED',
  'IN_TRANSIT',
  'ARRIVED',
  'WEIGHED',
  'INSPECTION_CONFIRMED',
  'QUALITY_ACCEPTED',
  'DELIVERY_ACCEPTED',
  'DOCUMENTS_COMPLETE',
  'RELEASE_REQUESTED',
  'RELEASED',
  'CLOSED',
] as const;

export const DEAL_REGISTRY_ROLES = Object.values(Role).filter(
  (role) => role !== Role.GUEST && role !== Role.BANK_CALLBACK,
);

function booleanQuery(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

export class ListAccessibleDealsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cursor?: string;

  @IsOptional()
  @IsIn(DEAL_REGISTRY_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(DEAL_REGISTRY_ROLES)
  role?: string;

  @IsOptional()
  @Transform(({ value }) => booleanQuery(value))
  @IsBoolean()
  actionable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  deadlineBefore?: string;
}
