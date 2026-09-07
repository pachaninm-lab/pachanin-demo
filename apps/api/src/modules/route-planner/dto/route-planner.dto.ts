import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AVG_SPEED_MAX_KMH,
  AVG_SPEED_MIN_KMH,
  GEOFENCE_MAX_PER_VEHICLE,
  GEOFENCE_NAME_MAX,
  GEOFENCE_RADIUS_MAX_METERS,
  GEOFENCE_RADIUS_MIN_METERS,
  GEOFENCE_TYPES,
  HEADING_MAX_DEGREES,
  HEADING_MIN_DEGREES,
  LATITUDE_MAX,
  LATITUDE_MIN,
  LONGITUDE_MAX,
  LONGITUDE_MIN,
  ROUTE_PLANNER_ID_MAX,
  SPEED_MAX_KMH,
  SPEED_MIN_KMH,
  TARIFF_DISTANCE_MAX_KM,
  TARIFF_DISTANCE_MIN_KM,
  TARIFF_WEIGHT_MAX_TONS,
  TARIFF_WEIGHT_MIN_TONS,
  VEHICLE_TYPES,
} from '../route-planner.contract';
import type { GeofenceType, VehicleType } from '../route-planner.contract';

/**
 * Тела планировщика маршрутов.
 *
 * Инлайн-тип `@Body() body: { … }` стирается до `Object`, и глобальный
 * ValidationPipe на него не действует — измерено в
 * `common/validation/request-body-validation-mechanism.spec.ts`.
 *
 * Ни в одном DTO здесь нет `@Type(() => Number)`: приведение выполнялось бы до
 * проверки диапазона, и строка молча стала бы числом. Замерено на сервисе:
 * тариф от строки «500» уже считался как от числа, потому что умножение
 * приводит само. Это и есть та тишина, которую граница обязана прекратить.
 */

class GeoCoordinatesDto {
  @IsNumber()
  @Min(LATITUDE_MIN)
  @Max(LATITUDE_MAX)
  lat!: number;

  @IsNumber()
  @Min(LONGITUDE_MIN)
  @Max(LONGITUDE_MAX)
  lng!: number;
}

export class UpdateVehiclePositionDto extends GeoCoordinatesDto {
  @IsOptional()
  @IsNumber()
  @Min(SPEED_MIN_KMH)
  @Max(SPEED_MAX_KMH)
  speed?: number;

  @IsOptional()
  @IsNumber()
  @Min(HEADING_MIN_DEGREES)
  @Max(HEADING_MAX_DEGREES)
  heading?: number;
}

export class GeofenceZoneDto extends GeoCoordinatesDto {
  @IsString()
  @Length(1, ROUTE_PLANNER_ID_MAX)
  id!: string;

  @IsString()
  @Length(1, GEOFENCE_NAME_MAX)
  name!: string;

  @IsNumber()
  @Min(GEOFENCE_RADIUS_MIN_METERS)
  @Max(GEOFENCE_RADIUS_MAX_METERS)
  radiusMeters!: number;

  @IsIn(GEOFENCE_TYPES)
  type!: GeofenceType;
}

/** Прежде тело уходило в сервис через `body.zones as any` — проверки не было вовсе. */
export class RegisterGeofencesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(GEOFENCE_MAX_PER_VEHICLE)
  @ValidateNested({ each: true })
  @Type(() => GeofenceZoneDto)
  zones!: GeofenceZoneDto[];
}

/**
 * Скорость строго положительна и это не косметика. Замерено: `avgSpeedKmh: 0`
 * давало Infinity в часах и `RangeError: Invalid time value` — 500 на вводе
 * пользователя. Отрицательная скорость ошибки не давала вовсе и возвращала
 * время прибытия во ВЧЕРАШНЕМ дне.
 */
export class CalculateEtaDto {
  @IsNumber()
  @Min(LATITUDE_MIN)
  @Max(LATITUDE_MAX)
  fromLat!: number;

  @IsNumber()
  @Min(LONGITUDE_MIN)
  @Max(LONGITUDE_MAX)
  fromLng!: number;

  @IsNumber()
  @Min(LATITUDE_MIN)
  @Max(LATITUDE_MAX)
  toLat!: number;

  @IsNumber()
  @Min(LONGITUDE_MIN)
  @Max(LONGITUDE_MAX)
  toLng!: number;

  @IsOptional()
  @IsNumber()
  @Min(AVG_SPEED_MIN_KMH)
  @Max(AVG_SPEED_MAX_KMH)
  avgSpeedKmh?: number;
}

/**
 * Тариф — это деньги. Замерено до исправления: неизвестный тип транспорта
 * давал `totalKopecks: NaN`, а в JSON — `null`; отрицательное расстояние
 * давало отрицательный тариф, то есть счёт в пользу плательщика.
 */
export class EstimateTariffDto {
  @IsNumber()
  @Min(TARIFF_DISTANCE_MIN_KM)
  @Max(TARIFF_DISTANCE_MAX_KM)
  distanceKm!: number;

  @IsNumber()
  @Min(TARIFF_WEIGHT_MIN_TONS)
  @Max(TARIFF_WEIGHT_MAX_TONS)
  weightTons!: number;

  @IsOptional()
  @IsIn(VEHICLE_TYPES)
  vehicleType?: VehicleType;
}
