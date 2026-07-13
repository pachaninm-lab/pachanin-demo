import { IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class FinalizeSampleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  protocolNumber!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  applicableStandard!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  accreditationId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  signedEvidenceRef!: string;

  @IsISO8601()
  finalizedAt!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  commandId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  idempotencyKey!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  expectedVersion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  correlationId?: string;
}
