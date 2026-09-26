import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/**
 * Акт взвешивания — документ, которым решается, сколько зерна принято.
 *
 * Тело объявлялось `any`, и это не преувеличение: `@Body() body: any`. Всё
 * измерено на живом сервисе до правки, брутто 100 / тара 20:
 *
 *   grossTons: 'abc'       → netTons NaN, acceptedTons NaN
 *                            в JSON: {"netTons":null,"acceptedTons":null}
 *   grossTons: -50         → netTons -70, acceptedTons 0, discrepancyTons -70
 *   grossTons: Infinity    → netTons null, discrepancyPct null
 *   gross 20 / tare 100    → netTons -80, принято 0, расхождение -80
 *
 * То есть акт приёмки без тоннажа вообще либо с отрицательным нетто. Это
 * количество зерна, а количество зерна — деньги.
 *
 * @IsNumber() без опций отвергает и NaN, и Infinity, и строку: allowNaN и
 * allowInfinity по умолчанию false, а @Type(() => Number) сюда намеренно НЕ
 * ставится — он превратил бы '100' в 100 до проверки. Строка '100' сегодня
 * проходит по случайности, из-за приведения в JS при вычитании; после правки
 * не проходит.
 */
export class CreateWeighingActDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  shipmentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  dealId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  elevatorOrgId!: string;

  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  grossTons!: number;

  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  tareTons!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  moisturePct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  impuritiesPct?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
