import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class DecideDisputeDto {
  @IsIn(['BUYER_WIN', 'SELLER_WIN', 'BUYER_WINS', 'SELLER_WINS', 'SPLIT', 'NO_CLAIM', 'CANCELLED'])
  outcome!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  splitBuyerPct?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9:_.-]{1,240}$/)
  idempotencyKey?: string;
}
