import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Role } from '../../../common/types/request-user';

const HUMAN_DEAL_ROLES = Object.values(Role).filter(
  (role) => role !== Role.GUEST && role !== Role.BANK_CALLBACK,
);

function optionalBoolean(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

export class DealRegistryQueryDto {
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

  /** Comma-separated canonical Deal statuses. */
  @IsOptional()
  @IsString()
  @MaxLength(1300)
  status?: string;

  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  actionable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  culture?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  region?: string;

  @IsOptional()
  @IsIn(HUMAN_DEAL_ROLES)
  role?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  deadlineBefore?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,19}$/)
  minMoneyKopecks?: string;
}
