/**
 * Значения, пересекающие границу запроса планировщика маршрутов, объявлены
 * здесь один раз: DTO и сервис читают отсюда и не заводят своих копий.
 */

export const GEOFENCE_TYPES = ['LOADING', 'UNLOADING', 'ELEVATOR', 'PORT', 'CHECKPOINT'] as const;
export type GeofenceType = (typeof GEOFENCE_TYPES)[number];

export const VEHICLE_TYPES = ['truck', 'rail', 'vessel'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

/** Тарифы за тонно-километр в копейках. Единственный источник для расчёта. */
export const TARIFF_RATE_KOPECKS_PER_TON_KM: Readonly<Record<VehicleType, number>> = Object.freeze({
  truck: 350,
  rail: 180,
  vessel: 90,
});

export const VAT_RATE = 0.2;

export const LATITUDE_MIN = -90;
export const LATITUDE_MAX = 90;
export const LONGITUDE_MIN = -180;
export const LONGITUDE_MAX = 180;

/**
 * Скорость строго положительна. Ноль давал деление на ноль, Infinity в часах
 * и `RangeError: Invalid time value` на `new Date(...).toISOString()`, то есть
 * ввод пользователя становился 500.
 */
export const AVG_SPEED_MIN_KMH = 1;
export const AVG_SPEED_MAX_KMH = 300;

export const HEADING_MIN_DEGREES = 0;
export const HEADING_MAX_DEGREES = 360;
export const SPEED_MIN_KMH = 0;
export const SPEED_MAX_KMH = 400;

export const GEOFENCE_RADIUS_MIN_METERS = 1;
export const GEOFENCE_RADIUS_MAX_METERS = 500_000;
export const GEOFENCE_MAX_PER_VEHICLE = 100;
export const GEOFENCE_NAME_MAX = 120;

export const TARIFF_DISTANCE_MIN_KM = 0;
export const TARIFF_DISTANCE_MAX_KM = 40_000;
export const TARIFF_WEIGHT_MIN_TONS = 0;
export const TARIFF_WEIGHT_MAX_TONS = 200_000;

export const ROUTE_PLANNER_ID_MAX = 64;
