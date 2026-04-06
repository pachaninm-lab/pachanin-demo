import { IsNumber, IsOptional, IsString } from 'class-validator';

export type ShipmentStatus = 'ASSIGNED' | 'DRIVER_CONFIRMED' | 'AT_LOADING' | 'LOADED' | 'IN_TRANSIT' | 'AT_UNLOADING' | 'UNLOADED' | 'CONFIRMED' | 'CANCELLED';

export class TransitionShipmentDto {
  nextState!: ShipmentStatus;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
