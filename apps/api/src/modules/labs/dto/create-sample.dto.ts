import { IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSampleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  dealId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  shipmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  acceptanceId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  evidenceRef!: string;

  @IsISO8601()
  occurredAt!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  commandId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  correlationId?: string;
}
