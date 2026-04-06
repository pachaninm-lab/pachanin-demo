import { IsOptional, IsString } from 'class-validator';

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
}
