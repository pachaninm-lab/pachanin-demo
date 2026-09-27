import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Ручное сопоставление строки выписки со сделкой.
 *
 * paymentId — прежнее имя того же поля, что и entryId; сервис читает
 * `body.entryId ?? body.paymentId ?? ''`, поэтому оба остаются необязательными:
 * сделать любое из них обязательным значило бы отказать вызывающим, которые
 * работали до сих пор. Обязателен только dealId, и он обязателен и в сервисе.
 */
export class ManualMatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  paymentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  entryId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  dealId!: string;
}
