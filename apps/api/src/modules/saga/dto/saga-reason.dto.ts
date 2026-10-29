import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Причина ручной паузы или пропуска шага саги.
 *
 * Оба обработчика подставляют значение по умолчанию (`body.reason ?? 'Manual
 * pause'`), поэтому поле остаётся необязательным: сделать его обязательным
 * значило бы отказывать вызывающим, которые работали до сих пор. Инлайн-тип,
 * стоявший здесь раньше, объявлял `reason: string` — то есть обязательным, —
 * и это было неправдой, которую никто не мог поймать: тип стирается до Object,
 * и ValidationPipe его не видит.
 */
export class SagaReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
