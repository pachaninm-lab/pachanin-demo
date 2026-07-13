import { IsISO8601, IsOptional, IsString, Length } from 'class-validator';

export class CreateSampleDto {
  @IsString()
  @Length(1, 200)
  dealId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  shipmentId?: string;

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

  @IsOptional()
  @IsString()
  @Length(1, 200)
  correlationId?: string;

  @IsISO8601({ strict: true })
  expectedDealUpdatedAt!: string;
}
