import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export type ShipmentStatus = 'ASSIGNED' | 'DRIVER_CONFIRMED' | 'AT_LOADING' | 'LOADED' | 'IN_TRANSIT' | 'AT_UNLOADING' | 'UNLOADED' | 'CONFIRMED' | 'CANCELLED';

export const SHIPMENT_STATUSES: readonly ShipmentStatus[] = [
  'ASSIGNED', 'DRIVER_CONFIRMED', 'AT_LOADING', 'LOADED', 'IN_TRANSIT',
  'AT_UNLOADING', 'UNLOADED', 'CONFIRMED', 'CANCELLED',
];

export class TransitionShipmentDto {
  // ShipmentStatus is a TypeScript union and erases at runtime, so the field
  // carried no constraint at all while the ratchet counted it as validated.
  // logistics.transition is a retired stub today - canonicalCommandRequired -
  // so this closes no exposure; it closes the gap that let a DTO field have no
  // decorator, which the next live handler would have inherited.
  @IsIn(SHIPMENT_STATUSES) nextState!: ShipmentStatus;

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
