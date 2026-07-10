import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDisputeDto {
  @IsString()
  @Matches(/^[A-Za-z0-9:_-]{1,180}$/)
  dealId!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9:_-]{1,180}$/)
  shipmentId?: string;

  @IsString()
  @MaxLength(120)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  detail?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  claimAmountKopecks?: number;

  /** Rejected by the service. Kept only to return an explicit migration error. */
  @IsOptional()
  claimAmountRub?: number;

  @IsString()
  @Matches(/^[A-Za-z0-9:_-]{1,180}$/)
  commandId!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9:_-]{1,180}$/)
  idempotencyKey!: string;
}
