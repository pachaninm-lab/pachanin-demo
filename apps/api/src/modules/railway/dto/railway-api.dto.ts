import { ArrayNotEmpty, IsArray, IsIn, IsISO8601, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

import type { WagonStatus, WagonType } from '../railway.service';

/**
 * Railway request bodies, as classes the pipe can see.
 *
 * Four handlers declared their body inline. WagonType and WagonStatus were
 * written in those inline types and therefore existed only at compile time: at
 * runtime any string was stored as a wagon's type, and any string became its
 * status. The unions below are the service's own, restated as values because
 * `type X = 'A' | 'B'` has none at runtime to enumerate.
 *
 * calculateDemurrage measures detention as
 * `Math.max(0, (completedMs - arrivedMs) / 3_600_000)`, and an unparseable date
 * makes that NaN - which Math.max does not clamp, because every comparison with
 * NaN is false. The charge then rounds to NaN and serialises as null. Both
 * instants are refused at the door instead.
 */

const WAGON_TYPES: readonly WagonType[] = ['HOPPER', 'COVERED', 'PLATFORM', 'TANK'];
const WAGON_STATUSES: readonly WagonStatus[] = ['FREE', 'ASSIGNED', 'IN_TRANSIT', 'MAINTENANCE'];


export class RegisterWagonDto {
  @IsString() @MaxLength(64) wagonNumber!: string;
  @IsIn(WAGON_TYPES) type!: WagonType;
  @IsNumber() @IsPositive() capacityTons!: number;
}

export class UpdateWagonStatusDto {
  @IsIn(WAGON_STATUSES) status!: WagonStatus;
  @IsOptional() @IsString() @MaxLength(240) dealId?: string;
}

export class CreateGU12Dto {
  @IsString() @MaxLength(240) dealId!: string;
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) @MaxLength(240, { each: true }) wagonIds!: string[];
  @IsString() @MaxLength(500) departureStation!: string;
  @IsString() @MaxLength(500) destinationStation!: string;
  @IsString() @MaxLength(500) cargo!: string;
  @IsNumber() @IsPositive() volumeTons!: number;
  @IsISO8601() requestedDepartureAt!: string;
}

export class CalculateDemurrageDto {
  @IsString() @MaxLength(240) wagonId!: string;
  @IsOptional() @IsString() @MaxLength(240) dealId?: string;
  @IsISO8601() arrivedAt!: string;
  @IsISO8601() unloadingCompletedAt!: string;
}
