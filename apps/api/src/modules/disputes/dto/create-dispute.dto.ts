import { IsIn, IsNumber, IsOptional, IsString, Matches } from 'class-validator';

export class CreateDisputeDto {
  @IsString()
  dealId!: string;

  @IsOptional()
  @IsString()
  shipmentId?: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  detail?: string;

  /** Compatibility input. New clients should send claimAmountKopecks. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  claimAmountRub?: number;

  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,18})$/)
  claimAmountKopecks?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9:_.-]{1,240}$/)
  idempotencyKey?: string;
}
