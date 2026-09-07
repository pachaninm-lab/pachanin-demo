import { IsIn, IsNumber, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import {
  COUNTRY_MAX,
  CULTURE_MAX,
  CURRENCIES,
  DISTANCE_MAX_KM,
  DISTANCE_MIN_KM,
  GOODS_DESCRIPTION_MAX,
  INCOTERMS_CODES,
  INN_PATTERN,
  INSURANCE_PCT_MAX,
  INSURANCE_PCT_MIN,
  PRICE_MAX_RUB,
  PRICE_MIN_RUB,
  TNVED_PATTERN,
  VOLUME_MAX_TONS,
  VOLUME_MIN_TONS,
} from '../export-trade.contract';
import type { Currency, IncotermsCode } from '../export-trade.contract';

/**
 * Тела экспортного модуля.
 *
 * Инлайн-тип `@Body() body: { … }` стирается до `Object`, и глобальный
 * ValidationPipe на него не действует — измерено в
 * `common/validation/request-body-validation-mechanism.spec.ts`.
 *
 * Ни в одном поле нет `@Type(() => Number)`, и здесь это особенно важно.
 * Замерено на сервисе: цена, присланная СТРОКОЙ «500», не складывалась с
 * фрахтом и страховкой, а КОНКАТЕНИРОВАЛАСЬ — итог получался
 * «5001750001» вместо 175 501, то есть завышение в 28 500 раз, и уходил в
 * ответ строкой. Приведение на границе спрятало бы этот дефект вместо того,
 * чтобы его отклонить.
 */

export class CalculateIncotermsDto {
  @IsNumber()
  @Min(PRICE_MIN_RUB)
  @Max(PRICE_MAX_RUB)
  priceRub!: number;

  @IsIn(INCOTERMS_CODES)
  incoterms!: IncotermsCode;

  @IsIn(CURRENCIES)
  currency!: Currency;

  @IsOptional()
  @IsNumber()
  @Min(DISTANCE_MIN_KM)
  @Max(DISTANCE_MAX_KM)
  distanceKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(VOLUME_MIN_TONS)
  @Max(VOLUME_MAX_TONS)
  volumeTons?: number;

  @IsOptional()
  @IsNumber()
  @Min(INSURANCE_PCT_MIN)
  @Max(INSURANCE_PCT_MAX)
  includeInsurancePct?: number;
}

export class ConvertCurrencyDto {
  @IsNumber()
  @Min(PRICE_MIN_RUB)
  @Max(PRICE_MAX_RUB)
  amountRub!: number;

  @IsIn(CURRENCIES)
  toCurrency!: Currency;
}

export class SubmitCustomsDto {
  @IsString()
  @Length(1, GOODS_DESCRIPTION_MAX)
  goodsDescription!: string;

  @IsString()
  @Matches(TNVED_PATTERN)
  tnvedCode!: string;

  @IsNumber()
  @Min(PRICE_MIN_RUB)
  @Max(PRICE_MAX_RUB)
  totalValueRub!: number;
}

export class ApplyPhytoDto {
  @IsString()
  @Length(1, CULTURE_MAX)
  culture!: string;

  @IsNumber()
  @Min(VOLUME_MIN_TONS)
  @Max(VOLUME_MAX_TONS)
  volumeTons!: number;

  @IsString()
  @Matches(INN_PATTERN)
  producerInn!: string;

  @IsString()
  @Length(1, COUNTRY_MAX)
  destinationCountry!: string;
}
