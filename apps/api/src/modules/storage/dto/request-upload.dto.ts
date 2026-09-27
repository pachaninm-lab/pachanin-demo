import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

/**
 * Запрос на загрузку доказательного файла.
 *
 * Сервис здесь уже защищался сам, и это проверено, а не предположено:
 * requiredIdentifier, sanitizeFilename, assertAllowedMime и assertAllowedSize
 * отвергают и не-строку, и не-целое, и отрицательный размер. Так что живого
 * дефекта на этом маршруте НЕ БЫЛО, и он себе не приписывается.
 *
 * DTO добавляется потому, что требование — про проверку на ГРАНИЦЕ: инлайн-тип
 * стирается до Object, ValidationPipe его пропускает, и защита держалась
 * целиком на том, что сервис не забыл проверить сам. Отказывают теперь и
 * граница, и сервис.
 *
 * @Type(() => Number) намеренно НЕ ставится: он превратил бы строку '9999' в
 * число ДО @IsInt, то есть отменил бы ровно ту проверку, ради которой стоит.
 * Верхняя граница размера остаётся за сервисом — она берётся из
 * OBJECT_STORAGE_MAX_BYTES и в DTO неизвестна.
 */
export class RequestUploadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  filename!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  dealId!: string;
}
