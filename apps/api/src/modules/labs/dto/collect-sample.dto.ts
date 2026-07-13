import { IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CollectSampleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  evidenceRef!: string;

  @IsISO8601()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

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
