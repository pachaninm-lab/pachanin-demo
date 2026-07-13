import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RecordTestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  metric!: string;

  @IsNumber()
  value!: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @IsOptional()
  @IsNumber()
  normMin?: number;

  @IsOptional()
  @IsNumber()
  normMax?: number;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  methodId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  equipmentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  correctionOfTestId?: string;

  @IsISO8601()
  recordedAt!: string;

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
