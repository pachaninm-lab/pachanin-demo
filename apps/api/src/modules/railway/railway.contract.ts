/**
 * Значения, пересекающие границу запроса железнодорожного модуля, объявлены
 * здесь один раз: DTO и сервис читают отсюда и не заводят своих копий.
 */

export const WAGON_TYPES = ['HOPPER', 'COVERED', 'PLATFORM', 'TANK'] as const;
export type WagonType = (typeof WAGON_TYPES)[number];

export const WAGON_STATUSES = ['FREE', 'ASSIGNED', 'IN_TRANSIT', 'MAINTENANCE'] as const;
export type WagonStatus = (typeof WAGON_STATUSES)[number];

export const GU12_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXECUTED'] as const;
export type GU12Status = (typeof GU12_STATUSES)[number];

/** Номер вагона на сети РЖД — восемь цифр. Демонстрационный парк им и следует. */
export const WAGON_NUMBER_PATTERN = /^\d{8}$/u;

export const WAGON_CAPACITY_MIN_TONS = 1;
export const WAGON_CAPACITY_MAX_TONS = 200;

export const GU12_MAX_WAGONS = 100;
export const GU12_STATION_MAX = 120;
export const GU12_CARGO_MAX = 120;
export const GU12_VOLUME_MIN_TONS = 1;
export const GU12_VOLUME_MAX_TONS = 20_000;

/** Идентификаторы приходят как cuid/uuid; предел с запасом, но не безграничный. */
export const RAILWAY_ID_MAX = 64;
