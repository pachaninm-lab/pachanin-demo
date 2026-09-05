import { IsIn, IsInt, IsString, Length, Max, Min } from 'class-validator';
import {
  ALLOWED_FACTORS,
  FACTORING_AMOUNT_MAX_KOPECKS,
  FACTORING_AMOUNT_MIN_KOPECKS,
  FACTORING_ID_MAX,
} from '../factoring.contract';

/**
 * Тело заявки на факторинг.
 *
 * Инлайн-тип `@Body() body: { … }` стирается до `Object`, и глобальный
 * ValidationPipe на него не действует — поэтому здесь не проверялось ничего.
 *
 * Замерено на живом сервисе до правки: сумма `-50 000 000` копеек проходила
 * до статуса APPROVED и записывалась в `approvedAmountKopecks` минусом;
 * `NaN` и `Infinity` давали заявку, одобренную вообще без суммы
 * (`null` в JSON); строка `'1000'` проходила молча, потому что умножение
 * приводило её к числу; `1e308` одобрялось как есть.
 *
 * `@Type(() => Number)` здесь сознательно НЕ применяется: приведение
 * выполнялось бы до проверки диапазона, и строка снова прошла бы границу.
 */
export class CreateFactoringApplicationDto {
  @IsString()
  @Length(1, FACTORING_ID_MAX)
  dealId!: string;

  @IsString()
  @Length(1, FACTORING_ID_MAX)
  organizationId!: string;

  @IsIn(ALLOWED_FACTORS as unknown as readonly string[])
  factorName!: string;

  /**
   * `@IsInt` отвергает строку, NaN и Infinity; `@Min`/`@Max` держат диапазон.
   * Копейки — целые по определению, дробной заявки не бывает.
   */
  @IsInt()
  @Min(FACTORING_AMOUNT_MIN_KOPECKS)
  @Max(FACTORING_AMOUNT_MAX_KOPECKS)
  requestedAmountKopecks!: number;
}
