import { IsOptional, IsString } from 'class-validator';

export class CreateSampleDto {
  @IsString()
  dealId!: string;

  @IsOptional()
  @IsString()
  shipmentId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
