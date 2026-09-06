import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Корректировка акта взвешивания.
 *
 * Здесь `any` был опаснее, чем при создании: корректировка правит УЖЕ
 * существующий акт. Измерено — акт с честным нетто 80 тонн после
 * `correctAct({ grossTons: 'мусор' })` становится `{"netTons":null,
 * "acceptedTons":null}`. То есть портится верная запись, а не создаётся
 * неверная.
 *
 * Все поля необязательны, потому что сервис берёт недостающее из самого акта
 * (`correction.grossTons ?? act.grossTons`). Сделать их обязательными значило
 * бы отказать вызывающим, которые правят одно поле.
 */
export class CorrectWeighingActDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  grossTons?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  tareTons?: number;

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
