import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Причина отзыва банковского ключа.
 *
 * Обработчик уже проверяет её сам — `String(body?.reason ?? '').trim()` длиной
 * не меньше пяти, со своим сообщением. Эта проверка НЕ переносится сюда и не
 * дублируется: DTO добавляется рядом, чтобы параметр вообще стал видим для
 * ValidationPipe (тип и потолок длины, срезание необъявленных полей), а
 * требование непустой причины остаётся там, где было, вместе с текстом ошибки.
 */
export class RevokeBankKeyDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
