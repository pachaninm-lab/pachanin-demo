import { IsISO8601, IsOptional, IsString, Length } from 'class-validator';

export class FinalizeSampleDto {
  @IsString()
  @Length(1, 200)
  commandId!: string;

  @IsString()
  @Length(1, 200)
  idempotencyKey!: string;

  @IsString()
  @Length(1, 30)
  expectedVersion!: string;

  @IsString()
  @Length(1, 200)
  protocolNumber!: string;

  @IsString()
  @Length(1, 200)
  applicableStandard!: string;

  @IsString()
  @Length(1, 200)
  accreditationRef!: string;

  @IsString()
  @Length(1, 200)
  signedEvidenceRef!: string;

  @IsISO8601({ strict: true })
  finalizedAt!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  correlationId?: string;
}
