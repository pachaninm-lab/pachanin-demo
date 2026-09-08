import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Route planner request bodies, as classes the global ValidationPipe can see.
 *
 * All four handlers declared their body as an inline TypeScript type, which
 * erases to Object at runtime, so the pipe validated none of them and every
 * number went straight into the arithmetic. Three consequences were measured
 * against the service's own code rather than supposed:
 *
 *  - `avgSpeedKmh: 0` divides distance by zero, so etaHours is Infinity and
 *    `new Date(Date.now() + Infinity).toISOString()` throws RangeError: Invalid
 *    time value. A malformed request answered with a 500.
 *  - A non-numeric latitude takes the same route through Haversine and throws
 *    the same RangeError.
 *  - A vehicleType outside truck/rail/vessel misses the rate table, so
 *    `Math.round(distanceKm * weightTons * undefined)` is NaN and the tariff
 *    comes back as `{"baseTariffKopecks": null, "totalKopecks": null}` - a quote
 *    with no number in it.
 *
 * A negative distance is the fourth: it produces a negative tariff, money owed
 * backwards, with nothing in the service to refuse it.
 *
 * NaN and Infinity are refused by @IsNumber() itself - class-validator's
 * isNumber rejects both unless allowNaN or allowInfinity is asked for - so no
 * option is passed here to say so again. An earlier version of this file passed
 * `{ allowNaN: false, allowInfinity: false }` explicitly and read as though that
 * were the protection; removing it changed no behaviour, which is how it was
 * found. @Min could not have done the job: every comparison against NaN is
 * false, so a bare @Min(0) would let NaN straight through.
 */


export class UpdateVehiclePositionDto {
  @IsNumber() @Min(-90) @Max(90) lat!: number;
  @IsNumber() @Min(-180) @Max(180) lng!: number;
  @IsOptional() @IsNumber() @Min(0) speed?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(360) heading?: number;
}

export class GeofenceZoneDto {
  @IsString() @MaxLength(240) id!: string;
  @IsString() @MaxLength(500) name!: string;
  @IsNumber() @Min(-90) @Max(90) lat!: number;
  @IsNumber() @Min(-180) @Max(180) lng!: number;
  @IsNumber() @IsPositive() radiusMeters!: number;
  @IsString() @MaxLength(64) type!: string;
}

export class RegisterGeofencesDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => GeofenceZoneDto) zones!: GeofenceZoneDto[];
}

export class CalculateEtaDto {
  @IsNumber() @Min(-90) @Max(90) fromLat!: number;
  @IsNumber() @Min(-180) @Max(180) fromLng!: number;
  @IsNumber() @Min(-90) @Max(90) toLat!: number;
  @IsNumber() @Min(-180) @Max(180) toLng!: number;
  // Strictly positive: zero is the division that ends as a RangeError, not a
  // slow journey. Absent still means the service's own default of 60.
  @IsOptional() @IsNumber() @IsPositive() avgSpeedKmh?: number;
}

export class EstimateTariffDto {
  @IsNumber() @Min(0) distanceKm!: number;
  @IsNumber() @Min(0) weightTons!: number;
  // The keys of the service's own rate table. Anything else misses it and the
  // whole quote becomes NaN.
  @IsOptional() @IsIn(['truck', 'rail', 'vessel']) vehicleType?: 'truck' | 'rail' | 'vessel';
}
