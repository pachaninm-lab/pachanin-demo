import { IsISO8601, IsNumber, IsOptional, IsString, Length } from 'class-validator';

export class RecordTestDto {
  @IsString()
  @Length(1, 200)
  metric!: string;

  @IsNumber()
  value!: number;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  unit?: string;

  @IsOptional()
  @IsNumber()
  normMin?: number;

  @IsOptional()
  @IsNumber()
  normMax?: number;

  @IsString()
  @Length(1, 200)
  methodId!: string;

  @IsString()
  @Length(1, 200)
  equipmentId!: string;

  @IsISO8601({ strict: true })
  recordedAt!: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  note?: string;

  @IsString()
  @Length(1, 200)
  commandId!: string;

  @IsString()
  @Length(1, 200)
  idempotencyKey!: string;

  @IsString()
  @Length(1, 30)
  expectedVersion!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  correlationId?: string;
}
