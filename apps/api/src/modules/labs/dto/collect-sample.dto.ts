import { IsISO8601, IsOptional, IsString, Length } from 'class-validator';

export class CollectSampleDto {
  @IsString()
  @Length(1, 200)
  commandId!: string;

  @IsString()
  @Length(1, 200)
  idempotencyKey!: string;

  @IsString()
  @Length(1, 30)
  expectedVersion!: string;

  @IsISO8601({ strict: true })
  occurredAt!: string;

  @IsString()
  @Length(1, 200)
  evidenceRef!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  sealCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  correlationId?: string;
}
