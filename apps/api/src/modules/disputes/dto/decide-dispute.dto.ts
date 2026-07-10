import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class DecideDisputeDto {
  @IsIn(['BUYER_WIN', 'SELLER_WIN', 'SPLIT', 'NO_CLAIM', 'CANCELLED'])
  outcome!: 'BUYER_WIN' | 'SELLER_WIN' | 'SPLIT' | 'NO_CLAIM' | 'CANCELLED';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  splitPct?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  note?: string;

  @IsString()
  @Matches(/^[A-Za-z0-9:_-]{1,180}$/)
  commandId!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9:_-]{1,180}$/)
  idempotencyKey!: string;
}
