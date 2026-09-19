import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateShipmentDto {
  @IsString()
  dealId!: string;

  @IsOptional()
  @IsString()
  carrierOrgId?: string;

  @IsOptional()
  @IsString()
  driverUserId?: string;

  @IsString()
  vehicleNumber!: string;

  @IsOptional()
  @IsString()
  trailerNumber?: string;

  @IsDateString()
  plannedLoadAt!: string;

  @IsOptional()
  @IsDateString()
  plannedUnloadAt?: string;

  @IsOptional()
  @IsString()
  fromAddress?: string;

  @IsOptional()
  @IsString()
  toAddress?: string;

  @IsOptional()
  @IsString()
  driverName?: string;
}
