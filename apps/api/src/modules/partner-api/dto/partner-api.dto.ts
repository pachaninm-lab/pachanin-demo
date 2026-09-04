import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

/**
 * Тела запросов партнёрского API (ASVS 5.0 V2.2.1 / V2.2.2).
 *
 * Три обработчика объявляли тело инлайн-типом. Инлайн-тип стирается до
 * `Object`, и глобальный `ValidationPipe` его не видит — это измерено в
 * apps/api/src/common/validation/request-body-validation-mechanism.spec.ts, а не
 * взято из документации Nest. Значит на этих трёх маршрутах не проверялось
 * ничего.
 *
 * Что из этого следовало, замерено на самом сервисе до правки, а не выведено:
 *
 *   rateLimit: 999999999      принято — ключ фактически без ограничения
 *   expiresInDays: -30        принято — ключ выпущен уже просроченным
 *   expiresInDays: 1e12       RangeError: Invalid time value, то есть 500
 *   scopes: 'deals:read'      TypeError: params.scopes.filter is not a function, то есть 500
 *   name длиной 100000        принято
 *   events: 'что-то*'         принято, и подписка совпала со ВСЕМИ событиями
 *
 * Последнее — не опечатка. `getActiveSubscriptionsForEvent` фильтрует по
 * `w.events.includes('*')`. У массива это проверка элемента, у строки —
 * проверка подстроки. Строка, содержащая звёздочку, подписывала вебхук на
 * каждое событие платформы; строка `'deal'` совпала бы с любым событием, в
 * имени которого есть `deal`. Поэтому `@IsArray()` здесь — не формальность.
 *
 * Проверки в сервисе (`AVAILABLE_SCOPES`, `outboundUrlProblem`) остаются на
 * месте и не дублируются здесь: они срабатывают после того, как форма уже
 * подтверждена, и их сохранение — часть ответа на «валидация не должна
 * переезжать из сервиса в DTO».
 *
 * Про `@IsArray()` ниже — предупреждение, а не украшение. Мутация показала,
 * что его снятие набор НЕ ловит, и причина замерена отдельно:
 *
 *   @ArrayMaxSize(5) + @IsIn(..., { each: true })   строка отклонена
 *   только @IsIn(..., { each: true })               строка ПРИНЯТА
 *   только @IsString({ each: true })                строка ПРИНЯТА
 *
 * То есть требование «это массив» держит `@ArrayMaxSize`, а `{ each: true }`
 * на не-массиве просто не срабатывает: это не проверка, а обход по кругу.
 * `@IsArray()` сейчас перекрыт и потому невидим для тестов — но снимать его на
 * том основании, что «тесты всё равно зелёные», нельзя: тогда единственной
 * опорой останется ограничение размера, и его правка молча вернёт сюда строку.
 */

/** Совпадает с AVAILABLE_SCOPES в partner-api.service.ts. */
export const PARTNER_API_SCOPES = [
  'deals:read',
  'deals:write',
  'shipments:read',
  'documents:read',
  'payments:read',
] as const;

export class GenerateApiKeyDto {
  @IsString()
  @Length(1, 200)
  name!: string;

  /**
   * Массив обязателен именно как массив. Строка `'deals:read'` раньше доходила
   * до `params.scopes.filter(...)` и превращалась в 500: отказ выглядел как
   * сбой сервера, а не как отклонённый запрос.
   */
  @IsArray()
  @ArrayMaxSize(PARTNER_API_SCOPES.length)
  @IsIn(PARTNER_API_SCOPES as unknown as string[], { each: true })
  scopes!: string[];

  /**
   * Верхняя граница названа. Без неё вызывающий выписывал себе ключ с
   * `rateLimit: 999999999`, то есть снимал собственное ограничение сам.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  rateLimit?: number;

  /**
   * Обе границы содержательны. Снизу — потому что отрицательное значение
   * выпускало ключ, просроченный в момент выдачи. Сверху — потому что
   * `new Date(Date.now() + days * 86_400_000).toISOString()` на больших
   * значениях бросает RangeError, и запрос заканчивался 500.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}

export class SubscribeWebhookDto {
  /**
   * Здесь только форма. Куда именно разрешено обращаться, решает
   * `outboundUrlProblem` в сервисе: список хостов — это политика развёртывания,
   * а не ограничение типа, и переносить её в DTO значило бы получить два
   * расходящихся источника истины.
   */
  @IsString()
  @Length(1, 2048)
  url!: string;

  @IsArray()
  @ArrayMaxSize(64)
  @IsString({ each: true })
  @Length(1, 128, { each: true })
  events!: string[];
}

export class TestWebhookDto {
  @IsOptional()
  @IsString()
  @Length(1, 128)
  eventType?: string;

  /**
   * Содержимое остаётся произвольным: это полезная нагрузка пробной доставки,
   * которую партнёр отправляет на собственный адрес. Ограничивается только тип —
   * объект, а не строка и не массив, — потому что дальше он уходит в
   * `JSON.stringify` внутри подписываемого HMAC тела.
   */
  @IsOptional()
  @IsObject()
  testData?: Record<string, unknown>;
}
