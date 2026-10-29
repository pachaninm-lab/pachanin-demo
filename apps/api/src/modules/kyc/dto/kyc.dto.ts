import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

/**
 * Тела запросов KYC/AML (ASVS 5.0 V2.2.1 / V2.2.2).
 *
 * Пять обработчиков объявляли тело инлайн-типом, который стирается до `Object`,
 * поэтому глобальный `ValidationPipe` не проверял на них ничего. Механизм
 * измерен отдельно, в common/validation/request-body-validation-mechanism.spec.ts.
 *
 * Здесь это не абстрактный долг: значения уходят в реестр ФНС, в проверку по
 * спискам ПОД/ФТ и в XML-уведомление Роскомнадзора об инциденте с
 * персональными данными.
 *
 * ИНН проверяется по длине и составу, а не «на непустоту». Десять цифр у
 * юридического лица, двенадцать у индивидуального предпринимателя — других
 * длин не бывает, и обращаться с посторонней строкой в государственный реестр
 * незачем. Контрольная сумма здесь НЕ считается: это отдельная проверка, её
 * место — в адаптере ФНС рядом с самим обращением, и заявлять её здесь значило
 * бы выдать проверку формы за проверку существования.
 */

/** ИНН: 10 цифр у организации, 12 у ИП. */
const INN_PATTERN = /^(\d{10}|\d{12})$/u;

export class VerifyOrganizationDto {
  @IsString()
  @Matches(INN_PATTERN, { message: 'inn должен содержать 10 или 12 цифр' })
  inn!: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  organizationName?: string;

  /** БИК — ровно девять цифр. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{9}$/u, { message: 'bik должен содержать 9 цифр' })
  bik?: string;

  /** Номер счёта — ровно двадцать цифр. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{20}$/u, { message: 'bankAccount должен содержать 20 цифр' })
  bankAccount?: string;
}

export class TransactionAmlCheckDto {
  @IsString()
  @Length(1, 200)
  transactionId!: string;

  /**
   * Сумма в копейках. Целое и неотрицательное: отрицательная сумма в проверке
   * по ПОД/ФТ не имеет смысла, а дробные копейки не существуют. Верхняя
   * граница — не «достаточно большое число», а предел точности `number`:
   * `Number.MAX_SAFE_INTEGER` копеек это порядка 90 триллионов рублей, и выше
   * него арифметика перестаёт быть точной молча.
   *
   * Приведения к числу здесь НЕТ, и это исправление после ревью. С
   * `@Type(() => Number)` пайп превращал `""`, строку из пробелов и `false` в
   * НОЛЬ ещё до того, как срабатывали `@IsInt` и границы, — замерено. То есть
   * проверка типа на границе, которую заявляла эта правка, для трёх значений
   * не выполнялась. Тело приходит как JSON, поэтому число обязано прийти
   * числом; строка `"100"` теперь тоже отклоняется, и это намеренно.
   */
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  amountKopecks!: number;

  @IsOptional()
  @IsString()
  @Matches(INN_PATTERN, { message: 'payerInn должен содержать 10 или 12 цифр' })
  payerInn?: string;

  @IsOptional()
  @IsString()
  @Matches(INN_PATTERN, { message: 'receiverInn должен содержать 10 или 12 цифр' })
  receiverInn?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  dealId?: string;
}

export class InitiateKycDto {
  @IsString()
  @Length(1, 200)
  organizationId!: string;

  @IsString()
  @Matches(INN_PATTERN, { message: 'inn должен содержать 10 или 12 цифр' })
  inn!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  documentType?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  notes?: string;
}

/**
 * Уведомление Роскомнадзора об инциденте с персональными данными.
 *
 * Это единственное тело здесь, чьи поля попадают в XML-документ для
 * регулятора. До этой правки они интерполировались в шаблон без какого-либо
 * кодирования, и замер показал не порчу разметки, а подделку содержания:
 * значение `description`, содержащее закрывающий тег, вносило в документ ВТОРОЙ
 * элемент `<КоличествоСубъектов>0</КоличествоСубъектов>` ПЕРЕД настоящим.
 * Парсер, читающий первое вхождение, увидел бы ноль пострадавших вместо
 * пятидесяти тысяч.
 *
 * Кодирование в сервисе — основная граница и остаётся на месте. Ограничения
 * здесь дополняют её, а не заменяют: они отсекают заведомо негодную форму до
 * того, как документ вообще начнёт собираться.
 */
export class RknIncidentDto {
  @IsString()
  @Length(1, 200)
  incidentType!: string;

  @IsString()
  @Length(1, 5000)
  description!: string;

  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  affectedSubjectsCount!: number;

  /**
   * Дата обнаружения инцидента: срок уведомления отсчитывается от неё.
   *
   * `strict` обязателен, а не желателен. Замерено: нестрогий `@IsDateString()`
   * принимает `2026-02-31`, а `new Date('2026-02-31')` молча даёт
   * `2026-03-03`. То есть документ регулятору и срок в 72 часа считались бы от
   * даты на три дня позже присланной — без единой ошибки по пути. В строгом
   * режиме такая дата отклоняется, а смещения часового пояса вида
   * `2026-09-01T01:00:00+03:00` по-прежнему принимаются.
   */
  @IsDateString({ strict: true })
  detectedAt!: string;

  @IsString()
  @Length(1, 300)
  reporterFullName!: string;

  @IsString()
  @Length(1, 300)
  reporterPosition!: string;
}

export class VerifyInnDto {
  @IsString()
  @Matches(INN_PATTERN, { message: 'inn должен содержать 10 или 12 цифр' })
  inn!: string;

  /** ОГРН: 13 цифр у организации, 15 у ИП. */
  @IsOptional()
  @IsString()
  @Matches(/^(\d{13}|\d{15})$/u, { message: 'ogrn должен содержать 13 или 15 цифр' })
  ogrn?: string;
}
