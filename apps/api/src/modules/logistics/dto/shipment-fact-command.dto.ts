import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class LogisticsCommandDto {
  @IsString()
  @Matches(/^[A-Za-z0-9:_.-]{1,200}$/)
  commandId!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9:_.-]{1,200}$/)
  idempotencyKey!: string;

  @IsString()
  @Matches(/^\d+$/)
  expectedVersion!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9:_.-]{1,200}$/)
  correlationId?: string;
}

export class RecordShipmentCheckpointDto extends LogisticsCommandDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_]{1,80}$/)
  type!: string;

  @IsISO8601()
  occurredAt!: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RecordShipmentGpsDto extends LogisticsCommandDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(250)
  speedKmh?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  headingDeg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  accuracyM?: number;

  @IsISO8601()
  recordedAt!: string;
}

export class VerifyShipmentPinDto extends LogisticsCommandDto {
  @IsString()
  @Matches(/^\d{4,12}$/)
  pin!: string;
}
